import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where = projectId ? { projectId } : {};

  const deliverables = await prisma.deliverable.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      statusLogs: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(deliverables);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, name, description, dueDate, assigneeId } = body;

  if (!projectId || !name?.trim() || !dueDate) {
    return NextResponse.json(
      { error: "projectId, name, and dueDate are required" },
      { status: 400 }
    );
  }

  const deliverable = await prisma.deliverable.create({
    data: {
      projectId,
      name: name.trim(),
      description: description || undefined,
      dueDate: new Date(dueDate),
      assigneeId: assigneeId || undefined,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(deliverable, { status: 201 });
}
