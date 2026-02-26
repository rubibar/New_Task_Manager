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

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const userId = searchParams.get("userId");
  const projectId = searchParams.get("projectId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const billable = searchParams.get("billable");

  const where: Record<string, unknown> = {};

  if (taskId) {
    where.taskId = taskId;
  }

  if (projectId) {
    where.task = { projectId };
  }

  if (startDate || endDate) {
    const startTimeFilter: Record<string, Date> = {};
    if (startDate) startTimeFilter.gte = new Date(startDate);
    if (endDate) startTimeFilter.lte = new Date(endDate);
    where.startTime = startTimeFilter;
  }

  if (billable !== null && billable !== undefined && billable !== "") {
    where.billable = billable === "true";
  }

  // If userId is specified use it; otherwise default to the current user
  if (userId) {
    where.userId = userId;
  } else if (!taskId && !projectId) {
    // No task/project filter and no explicit userId => scope to current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    where.userId = currentUser.id;
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: timeEntryInclude,
    orderBy: { startTime: "desc" },
  });

  return NextResponse.json(entries);
}

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
  const {
    taskId,
    startTime,
    endTime,
    duration,
    entryType,
    billable,
    note,
  } = body;

  // Validate required fields
  if (!taskId || !startTime) {
    return NextResponse.json(
      { error: "taskId and startTime are required" },
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

  const parsedStart = new Date(startTime);
  const parsedEnd = endTime ? new Date(endTime) : undefined;
  const resolvedType = entryType === "MANUAL" ? "MANUAL" : "TIMER";

  // For MANUAL entries, require either endTime or duration
  if (resolvedType === "MANUAL" && !parsedEnd && !duration) {
    return NextResponse.json(
      { error: "MANUAL entries require either endTime or duration" },
      { status: 400 }
    );
  }

  // Compute duration: if both endTime and duration are provided, derive from times
  let computedDuration: number | null = null;
  let computedEnd: Date | undefined = parsedEnd;

  if (parsedEnd) {
    computedDuration = Math.round(
      (parsedEnd.getTime() - parsedStart.getTime()) / 1000
    );
  } else if (duration) {
    computedDuration = Math.round(Number(duration));
    computedEnd = new Date(parsedStart.getTime() + computedDuration * 1000);
  }

  const entry = await prisma.timeEntry.create({
    data: {
      taskId,
      userId: currentUser.id,
      startTime: parsedStart,
      endTime: computedEnd || null,
      duration: computedDuration,
      entryType: resolvedType,
      billable: billable !== undefined ? Boolean(billable) : true,
      note: note || null,
    },
    include: timeEntryInclude,
  });

  return NextResponse.json(entry, { status: 201 });
}
