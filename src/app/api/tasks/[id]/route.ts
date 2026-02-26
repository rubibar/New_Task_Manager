import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCalendarEvent, deleteCalendarEvent } from "@/lib/calendar";
import { recalculateAndPersistScores } from "@/lib/scoring";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.type !== undefined) updateData.type = body.type;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.ownerId !== undefined) updateData.ownerId = body.ownerId;
  if (body.reviewerId !== undefined) updateData.reviewerId = body.reviewerId;
  if (body.projectId !== undefined) updateData.projectId = body.projectId;
  if (body.startDate !== undefined)
    updateData.startDate = new Date(body.startDate);
  if (body.deadline !== undefined) updateData.deadline = new Date(body.deadline);
  if (body.emergency !== undefined) updateData.emergency = body.emergency;

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  // Sync to calendar (use current user's token)
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  await updateCalendarEvent(task, currentUser?.id);

  // Recalculate all scores after edit
  recalculateAndPersistScores();

  return NextResponse.json(task);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { calendarEventId: true, ownerId: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Delete calendar event (use current user's token)
  if (task.calendarEventId) {
    const delUser = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    await deleteCalendarEvent(task.calendarEventId, task.ownerId, delUser?.id);
  }

  await prisma.task.delete({ where: { id: params.id } });

  // Recalculate remaining task scores after deletion
  recalculateAndPersistScores();

  return NextResponse.json({ success: true });
}
