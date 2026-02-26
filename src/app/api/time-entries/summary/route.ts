import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupBy = searchParams.get("groupBy") || "task";
  const taskId = searchParams.get("taskId");
  const projectId = searchParams.get("projectId");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Build the base where clause
  const where: Prisma.TimeEntryWhereInput = {};

  if (taskId) where.taskId = taskId;
  if (projectId) where.task = { projectId };
  if (userId) where.userId = userId;

  if (startDate || endDate) {
    const startTimeFilter: Record<string, Date> = {};
    if (startDate) startTimeFilter.gte = new Date(startDate);
    if (endDate) startTimeFilter.lte = new Date(endDate);
    where.startTime = startTimeFilter;
  }

  // If no user filter, default to current user
  if (!userId && !taskId && !projectId) {
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    where.userId = currentUser.id;
  }

  if (groupBy === "task") {
    return NextResponse.json(await groupByTask(where));
  } else if (groupBy === "project") {
    return NextResponse.json(await groupByProject(where));
  } else if (groupBy === "user") {
    return NextResponse.json(await groupByUser(where));
  } else if (groupBy === "day") {
    return NextResponse.json(await groupByDay(where));
  }

  return NextResponse.json(
    { error: "Invalid groupBy. Use: task, project, user, or day" },
    { status: 400 }
  );
}

async function groupByTask(where: Prisma.TimeEntryWhereInput) {
  const entries = await prisma.timeEntry.findMany({
    where: { ...where, duration: { not: null } },
    select: {
      taskId: true,
      duration: true,
      billable: true,
      task: {
        select: {
          id: true,
          title: true,
          estimatedHours: true,
          projectId: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      taskId: string;
      taskTitle: string;
      estimatedHours: number | null;
      project: { id: string; name: string; color: string } | null;
      totalSeconds: number;
      billableSeconds: number;
      entryCount: number;
    }
  >();

  for (const e of entries) {
    const dur = e.duration ?? 0;
    const existing = map.get(e.taskId);
    if (existing) {
      existing.totalSeconds += dur;
      if (e.billable) existing.billableSeconds += dur;
      existing.entryCount += 1;
    } else {
      map.set(e.taskId, {
        taskId: e.taskId,
        taskTitle: e.task.title,
        estimatedHours: e.task.estimatedHours,
        project: e.task.project,
        totalSeconds: dur,
        billableSeconds: e.billable ? dur : 0,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values());
}

async function groupByProject(where: Prisma.TimeEntryWhereInput) {
  const entries = await prisma.timeEntry.findMany({
    where: { ...where, duration: { not: null } },
    select: {
      duration: true,
      billable: true,
      task: {
        select: {
          projectId: true,
          project: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      projectId: string | null;
      projectName: string;
      projectColor: string;
      totalSeconds: number;
      billableSeconds: number;
      entryCount: number;
    }
  >();

  for (const e of entries) {
    const dur = e.duration ?? 0;
    const key = e.task.projectId || "__no_project__";
    const existing = map.get(key);
    if (existing) {
      existing.totalSeconds += dur;
      if (e.billable) existing.billableSeconds += dur;
      existing.entryCount += 1;
    } else {
      map.set(key, {
        projectId: e.task.projectId,
        projectName: e.task.project?.name || "No Project",
        projectColor: e.task.project?.color || "#888888",
        totalSeconds: dur,
        billableSeconds: e.billable ? dur : 0,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values());
}

async function groupByUser(where: Prisma.TimeEntryWhereInput) {
  const entries = await prisma.timeEntry.findMany({
    where: { ...where, duration: { not: null } },
    select: {
      userId: true,
      duration: true,
      billable: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const map = new Map<
    string,
    {
      userId: string;
      userName: string;
      userImage: string | null;
      totalSeconds: number;
      billableSeconds: number;
      entryCount: number;
    }
  >();

  for (const e of entries) {
    const dur = e.duration ?? 0;
    const existing = map.get(e.userId);
    if (existing) {
      existing.totalSeconds += dur;
      if (e.billable) existing.billableSeconds += dur;
      existing.entryCount += 1;
    } else {
      map.set(e.userId, {
        userId: e.userId,
        userName: e.user.name,
        userImage: e.user.image,
        totalSeconds: dur,
        billableSeconds: e.billable ? dur : 0,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values());
}

async function groupByDay(where: Prisma.TimeEntryWhereInput) {
  const entries = await prisma.timeEntry.findMany({
    where: { ...where, duration: { not: null } },
    select: {
      startTime: true,
      duration: true,
      billable: true,
    },
    orderBy: { startTime: "asc" },
  });

  const map = new Map<
    string,
    {
      date: string;
      totalSeconds: number;
      billableSeconds: number;
      entryCount: number;
    }
  >();

  for (const e of entries) {
    const dur = e.duration ?? 0;
    // Group by date string (YYYY-MM-DD) in UTC
    const dateKey = e.startTime.toISOString().slice(0, 10);
    const existing = map.get(dateKey);
    if (existing) {
      existing.totalSeconds += dur;
      if (e.billable) existing.billableSeconds += dur;
      existing.entryCount += 1;
    } else {
      map.set(dateKey, {
        date: dateKey,
        totalSeconds: dur,
        billableSeconds: e.billable ? dur : 0,
        entryCount: 1,
      });
    }
  }

  return Array.from(map.values());
}
