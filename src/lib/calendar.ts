import { google } from "googleapis";
import { prisma } from "./prisma";
import type { Task, TaskType } from "@prisma/client";

// Use user's primary calendar for all operations
const CALENDAR_ID = "primary";

// Google Calendar color IDs mapped to task types
const TYPE_COLORS: Record<TaskType, string> = {
  CLIENT: "11", // Tomato
  INTERNAL_RD: "2", // Sage
  ADMIN: "8", // Graphite
};

async function getAuthClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessToken: true, refreshToken: true, tokenExpiry: true },
  });

  if (!user?.accessToken) {
    throw new Error("User has no access token");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  });

  // Check if token is expired and refresh
  if (user.tokenExpiry && new Date() > user.tokenExpiry && user.refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.user.update({
        where: { id: userId },
        data: {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token || user.refreshToken,
          tokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
      });
      oauth2Client.setCredentials(credentials);
    } catch {
      console.error("Failed to refresh access token for user", userId);
    }
  }

  return oauth2Client;
}

function buildEventBody(
  task: Task & { project?: { name: string } | null; owner?: { name: string } | null }
) {
  const projectPrefix = task.project?.name ? `[${task.project.name}] ` : "";
  return {
    summary: `${projectPrefix}${task.title}`,
    start: {
      dateTime: new Date(task.startDate).toISOString(),
      timeZone: "Asia/Jerusalem",
    },
    end: {
      dateTime: new Date(task.deadline).toISOString(),
      timeZone: "Asia/Jerusalem",
    },
    description: [
      `Type: ${task.type} | Priority: ${task.priority} | Owner: ${task.owner?.name || "Unknown"} | Status: ${task.status}`,
      "",
      task.description || "",
    ].join("\n"),
    colorId: TYPE_COLORS[task.type],
  };
}

export async function createCalendarEvent(
  task: Task & { project?: { name: string } | null; owner?: { name: string } | null },
  authUserId?: string
): Promise<string | null> {
  try {
    const auth = await getAuthClient(authUserId || task.ownerId);
    const calendar = google.calendar({ version: "v3", auth });
    const event = buildEventBody(task);

    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    return response.data.id || null;
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return null;
  }
}

export async function updateCalendarEvent(
  task: Task & { project?: { name: string } | null; owner?: { name: string } | null },
  authUserId?: string
): Promise<void> {
  if (!task.calendarEventId) return;

  try {
    const auth = await getAuthClient(authUserId || task.ownerId);
    const calendar = google.calendar({ version: "v3", auth });
    const event = buildEventBody(task);

    await calendar.events.update({
      calendarId: CALENDAR_ID,
      eventId: task.calendarEventId,
      requestBody: event,
    });
  } catch (error) {
    console.error("Failed to update calendar event:", error);
  }
}

export async function deleteCalendarEvent(
  calendarEventId: string,
  userId: string,
  authUserId?: string
): Promise<void> {
  try {
    const auth = await getAuthClient(authUserId || userId);
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: calendarEventId,
    });
  } catch (error) {
    console.error("Failed to delete calendar event:", error);
  }
}

/**
 * Bidirectional sync: for each user with tokens, read their primary calendar
 * and update linked tasks if dates were changed in Google Calendar.
 */
export async function syncCalendarEvents(): Promise<void> {
  // Get all users with valid tokens
  const users = await prisma.user.findMany({
    where: { accessToken: { not: null } },
    select: { id: true },
  });

  if (users.length === 0) {
    console.error("No users with access tokens for calendar sync");
    return;
  }

  // Get all tasks that have a linked calendar event
  const linkedTasks = await prisma.task.findMany({
    where: { calendarEventId: { not: null } },
    select: { id: true, calendarEventId: true, startDate: true, deadline: true, ownerId: true },
  });

  if (linkedTasks.length === 0) return;

  // Build a map of calendarEventId -> task for quick lookup
  const taskByEventId = new Map(
    linkedTasks.map((t) => [t.calendarEventId!, t])
  );

  // For each user, fetch their primary calendar events and check for changes
  for (const user of users) {
    try {
      const auth = await getAuthClient(user.id);
      const calendar = google.calendar({ version: "v3", auth });

      const now = new Date();
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const fourWeeksFromNow = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

      const response = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: fourWeeksAgo.toISOString(),
        timeMax: fourWeeksFromNow.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
      });

      const events = response.data.items || [];

      for (const event of events) {
        if (!event.id) continue;

        const task = taskByEventId.get(event.id);
        if (!task) continue;

        // Check if dates changed in Google Calendar
        const eventStart = event.start?.dateTime
          ? new Date(event.start.dateTime)
          : event.start?.date
            ? new Date(event.start.date)
            : null;
        const eventEnd = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : event.end?.date
            ? new Date(event.end.date)
            : null;

        if (eventStart && eventEnd) {
          const startChanged =
            Math.abs(task.startDate.getTime() - eventStart.getTime()) > 60000;
          const endChanged =
            Math.abs(task.deadline.getTime() - eventEnd.getTime()) > 60000;

          if (startChanged || endChanged) {
            await prisma.task.update({
              where: { id: task.id },
              data: {
                startDate: eventStart,
                deadline: eventEnd,
              },
            });
            console.log(`Synced task ${task.id} dates from Google Calendar`);
          }
        }

        // Check if event was cancelled/deleted
        if (event.status === "cancelled") {
          await prisma.task.update({
            where: { id: task.id },
            data: { calendarEventId: null },
          });
          console.log(`Unlinked cancelled calendar event from task ${task.id}`);
        }
      }
    } catch (error) {
      console.error(`Calendar sync failed for user ${user.id}:`, error);
    }
  }
}
