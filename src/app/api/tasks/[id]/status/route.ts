import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyReviewRequest } from "@/lib/notifications";
import { updateCalendarEvent } from "@/lib/calendar";
import { recalculateAndPersistScores } from "@/lib/scoring";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { status } = body;

  if (!status) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  // Review loop: "Pass the Baton"
  // When owner marks as DONE → auto-change to IN_REVIEW
  if (status === "DONE" && task.reviewerId) {
    updateData.status = "IN_REVIEW";

    // Notify reviewer
    await notifyReviewRequest(
      task.reviewerId,
      task.title,
      task.owner.name,
      task.id
    );
  } else if (status === "DONE" && !task.reviewerId) {
    // No reviewer, just mark as done
    updateData.status = "DONE";
  } else if (status === "APPROVED") {
    // Reviewer approves → mark as DONE
    updateData.status = "DONE";
  } else if (status === "REQUEST_CHANGES") {
    // Reviewer requests changes → back to IN_PROGRESS
    updateData.status = "IN_PROGRESS";
  } else {
    updateData.status = status;
  }

  // Track when task enters TODO status
  if (updateData.status === "TODO" && task.status !== "TODO") {
    updateData.todoSince = new Date();
  }
  // Clear todoSince when leaving TODO
  if (updateData.status !== "TODO" && task.status === "TODO") {
    updateData.todoSince = null;
  }

  const updatedTask = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      reviewer: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true, color: true } },
    },
  });

  // Sync calendar
  await updateCalendarEvent(updatedTask);

  // Recalculate all scores after status change
  recalculateAndPersistScores();

  return NextResponse.json(updatedTask);
}
