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
  if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate);
  if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId || null;

  // Handle status change with audit log
  if (body.status !== undefined) {
    const current = await prisma.deliverable.findUnique({
      where: { id: params.id },
      select: { status: true },
    });

    if (current && current.status !== body.status) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (user) {
        await prisma.deliverableStatusLog.create({
          data: {
            deliverableId: params.id,
            oldStatus: current.status,
            newStatus: body.status,
            changedById: user.id,
          },
        });
      }
    }

    updateData.status = body.status;
  }

  const deliverable = await prisma.deliverable.update({
    where: { id: params.id },
    data: updateData,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      statusLogs: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(deliverable);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.deliverable.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
