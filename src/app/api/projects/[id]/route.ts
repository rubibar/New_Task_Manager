import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.clientName !== undefined) updateData.clientName = body.clientName;
  if (body.clientId !== undefined) updateData.clientId = body.clientId || null;
  if (body.projectTypeId !== undefined) updateData.projectTypeId = body.projectTypeId || null;
  if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.targetFinishDate !== undefined) updateData.targetFinishDate = body.targetFinishDate ? new Date(body.targetFinishDate) : null;
  if (body.budget !== undefined) updateData.budget = body.budget != null ? Number(body.budget) : null;
  if (body.shiftRate !== undefined) updateData.shiftRate = body.shiftRate != null ? Number(body.shiftRate) : null;
  if (body.hourlyRate !== undefined) updateData.hourlyRate = body.hourlyRate != null ? Number(body.hourlyRate) : null;

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
    include: {
      projectType: true,
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for active tasks
  const activeTasks = await prisma.task.count({
    where: {
      projectId: params.id,
      status: { not: "DONE" },
    },
  });

  if (activeTasks > 0) {
    return NextResponse.json(
      { error: "Cannot delete project with active tasks" },
      { status: 400 }
    );
  }

  await prisma.project.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
