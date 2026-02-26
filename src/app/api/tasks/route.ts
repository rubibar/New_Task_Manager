import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/calendar";
import { notifyTaskAssigned } from "@/lib/notifications";
import { recalculateAndPersistScores } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const ownerId = searchParams.get("ownerId");
  const projectId = searchParams.get("projectId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: { displayScore: "desc" },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    description,
    type,
    priority,
    ownerId,
    reviewerId,
    projectId,
    startDate,
    deadline,
    emergency,
    estimatedHours,
  } = body;

  if (!title || !ownerId || !startDate || !deadline) {
    return NextResponse.json(
      { error: "Missing required fields: title, ownerId, startDate, deadline" },
      { status: 400 }
    );
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      type: type || "CLIENT",
      priority: priority || "IMPORTANT_NOT_URGENT",
      ownerId,
      reviewerId: reviewerId || null,
      projectId: projectId || null,
      startDate: new Date(startDate),
      deadline: new Date(deadline),
      emergency: emergency || false,
      estimatedHours: estimatedHours != null ? Number(estimatedHours) : undefined,
      todoSince: new Date(),
    },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  // Recalculate all scores (including this new task) — runs async, doesn't block
  recalculateAndPersistScores();

  // Find current user for calendar auth + notifications
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });

  // Create calendar event (use current user's token, not task owner's)
  const calendarEventId = await createCalendarEvent(task, currentUser?.id);
  if (calendarEventId) {
    await prisma.task.update({
      where: { id: task.id },
      data: { calendarEventId },
    });
  }

  if (currentUser && ownerId !== currentUser.id) {
    await notifyTaskAssigned(ownerId, title, "owner", task.id);
  }
  if (reviewerId && reviewerId !== currentUser?.id) {
    await notifyTaskAssigned(reviewerId, title, "reviewer", task.id);
  }

  return NextResponse.json(task, { status: 201 });
}
