import { google } from "googleapis";
import { prisma } from "./prisma";
import type { Task, TaskType } from "@prisma/client";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

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

export async function syncCalendarEvents(): Promise<void> {
  // Get first available user for API calls
  const user = await prisma.user.findFirst({
    where: { accessToken: { not: null } },
    select: { id: true },
  });

  if (!user) {
    console.error("No user with access token for calendar sync");
    return;
  }

  try {
    const auth = await getAuthClient(user.id);
    const calendar = google.calendar({ version: "v3", auth });

    // Fetch recent events from the shared calendar
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: twoWeeksAgo.toISOString(),
      timeMax: twoWeeksFromNow.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];

    for (const event of events) {
      if (!event.id || !event.summary) continue;

      // Check if this event is already linked to a task
      const existingTask = await prisma.task.findUnique({
        where: { calendarEventId: event.id },
      });

      if (existingTask) {
        // Update task dates if changed in calendar
        const eventStart = event.start?.dateTime
          ? new Date(event.start.dateTime)
          : null;
        const eventEnd = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : null;

        if (eventStart && eventEnd) {
          const startChanged =
            existingTask.startDate.getTime() !== eventStart.getTime();
          const endChanged =
            existingTask.deadline.getTime() !== eventEnd.getTime();

          if (startChanged || endChanged) {
            await prisma.task.update({
              where: { id: existingTask.id },
              data: {
                startDate: eventStart,
                deadline: eventEnd,
              },
            });
          }
        }
      }
      // Note: New calendar events without matching tasks could be handled here
      // but we skip auto-creation for safety — users should create tasks in-app
    }
  } catch (error) {
    console.error("Calendar sync failed:", error);
  }
}
