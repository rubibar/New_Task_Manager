import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoSequenceDeliverableTasks } from "@/lib/dependencies";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!deliverable) {
    return NextResponse.json(
      { error: "Deliverable not found" },
      { status: 404 }
    );
  }

  await autoSequenceDeliverableTasks(params.id);

  const updated = await prisma.deliverable.findUnique({
    where: { id: params.id },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      tasks: {
        select: { id: true, title: true, status: true, category: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json(updated);
}
