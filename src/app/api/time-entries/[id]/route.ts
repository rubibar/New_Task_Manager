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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Fetch existing entry
  const existing = await prisma.timeEntry.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Time entry not found" },
      { status: 404 }
    );
  }

  // Only the entry owner can update
  if (existing.userId !== currentUser.id) {
    return NextResponse.json(
      { error: "Only the entry owner can update this time entry" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.billable !== undefined) updateData.billable = Boolean(body.billable);
  if (body.note !== undefined) updateData.note = body.note;

  // Handle time fields and recompute duration
  const newStart = body.startTime
    ? new Date(body.startTime)
    : existing.startTime;
  const newEnd = body.endTime !== undefined
    ? body.endTime
      ? new Date(body.endTime)
      : null
    : existing.endTime;

  if (body.startTime !== undefined) updateData.startTime = newStart;
  if (body.endTime !== undefined) updateData.endTime = newEnd;

  // Recompute duration if we have both start and end
  if (newStart && newEnd) {
    updateData.duration = Math.round(
      (newEnd.getTime() - newStart.getTime()) / 1000
    );
  } else if (body.duration !== undefined) {
    // Explicit duration override (no endTime)
    updateData.duration = Math.round(Number(body.duration));
  }

  const entry = await prisma.timeEntry.update({
    where: { id: params.id },
    data: updateData,
    include: timeEntryInclude,
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const existing = await prisma.timeEntry.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Time entry not found" },
      { status: 404 }
    );
  }

  // Only the entry owner can delete
  if (existing.userId !== currentUser.id) {
    return NextResponse.json(
      { error: "Only the entry owner can delete this time entry" },
      { status: 403 }
    );
  }

  await prisma.timeEntry.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
