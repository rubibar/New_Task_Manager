import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, phase, sortOrder, defaultTasks, isActive } = body;

  const template = await prisma.deliverableTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(phase !== undefined && { phase }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(defaultTasks !== undefined && { defaultTasks }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.deliverableTemplate.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
