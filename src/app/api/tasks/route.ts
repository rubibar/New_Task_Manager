import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/calendar";
import { notifyTaskAssigned } from "@/lib/notifications";
import { recalculateAndPersistScores } from "@/lib/scoring";
import { autoSequenceDeliverableTasks } from "@/lib/dependencies";

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
  const deliverableId = searchParams.get("deliverableId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (ownerId) where.ownerId = ownerId;
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;
  if (deliverableId) where.deliverableId = deliverableId;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
      checklistItems: { select: { id: true, completed: true } },
      deliverable: { select: { id: true, name: true } },
      dependencies: { select: { dependsOnId: true } },
      dependents: { select: { taskId: true } },
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
    deliverableId,
    startDate,
    deadline,
    emergency,
    estimatedHours,
    category,
    checklistItems: checklistItemsInput,
  } = body;

  if (!title || !ownerId) {
    return NextResponse.json(
      { error: "Missing required fields: title, ownerId" },
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
      deliverableId: deliverableId || null,
      startDate: startDate ? new Date(startDate) : null,
      deadline: deadline ? new Date(deadline) : null,
      emergency: emergency || false,
      estimatedHours: estimatedHours != null ? Number(estimatedHours) : undefined,
      category: category || undefined,
      todoSince: new Date(),
      checklistItems: checklistItemsInput?.length
        ? {
            create: checklistItemsInput.map(
              (item: { text: string }, idx: number) => ({
                text: item.text,
                sortOrder: idx,
              })
            ),
          }
        : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
      checklistItems: { select: { id: true, completed: true } },
      deliverable: { select: { id: true, name: true } },
    },
  });

  // Auto-sequence if task is linked to a deliverable
  if (deliverableId) {
    autoSequenceDeliverableTasks(deliverableId).catch(() => {});
  }

  // Recalculate all scores (including this new task) — runs async, doesn't block
  recalculateAndPersistScores();

  // Find current user for calendar auth + notifications
  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });

  // Create calendar event only for scheduled tasks (use current user's token)
  if (task.startDate && task.deadline) {
    const calendarEventId = await createCalendarEvent(task, currentUser?.id);
    if (calendarEventId) {
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId },
      });
    }
  }

  if (currentUser && ownerId !== currentUser.id) {
    await notifyTaskAssigned(ownerId, title, "owner", task.id);
  }
  if (reviewerId && reviewerId !== currentUser?.id) {
    await notifyTaskAssigned(reviewerId, title, "reviewer", task.id);
  }

  return NextResponse.json(task, { status: 201 });
}
