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

  const milestones = await prisma.milestone.findMany({
    where,
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(milestones);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, name, dueDate } = body;

  if (!projectId || !name?.trim() || !dueDate) {
    return NextResponse.json(
      { error: "projectId, name, and dueDate are required" },
      { status: 400 }
    );
  }

  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name: name.trim(),
      dueDate: new Date(dueDate),
    },
  });

  return NextResponse.json(milestone, { status: 201 });
}
