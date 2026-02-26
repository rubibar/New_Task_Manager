import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const timeEntryInclude = {
  task: {
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { id: true, name: true, color: true } },
    },
  },
  user: { select: { id: true, name: true, email: true, image: true } },
};

/** GET — Return the user's currently running timer (if any) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const running = await prisma.timeEntry.findFirst({
    where: {
      userId: currentUser.id,
      entryType: "TIMER",
      endTime: null,
    },
    include: timeEntryInclude,
    orderBy: { startTime: "desc" },
  });

  return NextResponse.json(running);
}

/** POST — Start a new timer for a task. Auto-stops any existing running timer. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { taskId } = body;

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  // Validate task exists
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const now = new Date();

  // If user already has a running timer, stop it first
  const existing = await prisma.timeEntry.findFirst({
    where: {
      userId: currentUser.id,
      entryType: "TIMER",
      endTime: null,
    },
  });

  if (existing) {
    const duration = Math.round(
      (now.getTime() - existing.startTime.getTime()) / 1000
    );
    await prisma.timeEntry.update({
      where: { id: existing.id },
      data: { endTime: now, duration },
    });
  }

  // Create a new running timer
  const entry = await prisma.timeEntry.create({
    data: {
      taskId,
      userId: currentUser.id,
      startTime: now,
      endTime: null,
      duration: null,
      entryType: "TIMER",
      billable: true,
    },
    include: timeEntryInclude,
  });

  return NextResponse.json(entry, { status: 201 });
}

/** PATCH — Stop the currently running timer */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find the running timer
  const running = await prisma.timeEntry.findFirst({
    where: {
      userId: currentUser.id,
      entryType: "TIMER",
      endTime: null,
    },
  });

  if (!running) {
    return NextResponse.json(
      { error: "No running timer found" },
      { status: 404 }
    );
  }

  // Optionally accept a note
  let note: string | undefined;
  try {
    const body = await request.json();
    note = body.note;
  } catch {
    // No body is fine — note is optional
  }

  const now = new Date();
  const duration = Math.round(
    (now.getTime() - running.startTime.getTime()) / 1000
  );

  const updateData: Record<string, unknown> = {
    endTime: now,
    duration,
  };
  if (note !== undefined) {
    updateData.note = note;
  }

  const entry = await prisma.timeEntry.update({
    where: { id: running.id },
    data: updateData,
    include: timeEntryInclude,
  });

  return NextResponse.json(entry);
}
