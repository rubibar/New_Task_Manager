import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.text !== undefined) updateData.text = body.text;
  if (body.completed !== undefined) updateData.completed = body.completed;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const item = await prisma.checklistItem.update({
    where: { id: params.itemId },
    data: updateData,
  });

  return NextResponse.json(item);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.checklistItem.delete({
    where: { id: params.itemId },
  });

  return NextResponse.json({ success: true });
}
