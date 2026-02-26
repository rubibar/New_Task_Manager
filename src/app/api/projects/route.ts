import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        select: { status: true },
      },
      projectType: true,
      deliverables: true,
      milestones: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    color,
    clientName,
    projectTypeId,
    startDate,
    targetFinishDate,
    budget,
    shiftRate,
    hourlyRate,
    status,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      color: color || "#C8FF00",
      clientName: clientName || undefined,
      projectTypeId: projectTypeId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      targetFinishDate: targetFinishDate ? new Date(targetFinishDate) : undefined,
      budget: budget != null ? Number(budget) : undefined,
      shiftRate: shiftRate != null ? Number(shiftRate) : undefined,
      hourlyRate: hourlyRate != null ? Number(hourlyRate) : undefined,
      status: status || undefined,
    },
    include: {
      projectType: true,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
