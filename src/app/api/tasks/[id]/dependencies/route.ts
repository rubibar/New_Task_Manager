import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { wouldCreateCycle, cascadeDateShift } from "@/lib/dependencies";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { dependsOnId } = body;

  if (!dependsOnId) {
    return NextResponse.json(
      { error: "dependsOnId is required" },
      { status: 400 }
    );
  }

  if (params.id === dependsOnId) {
    return NextResponse.json(
      { error: "A task cannot depend on itself" },
      { status: 400 }
    );
  }

  // Check for cycles
  const cycle = await wouldCreateCycle(params.id, dependsOnId);
  if (cycle) {
    return NextResponse.json(
      { error: "Adding this dependency would create a circular reference" },
      { status: 400 }
    );
  }

  const dep = await prisma.taskDependency.create({
    data: {
      taskId: params.id,
      dependsOnId,
    },
    include: {
      dependsOn: { select: { id: true, title: true, status: true } },
    },
  });

  // Cascade date shifts from the prerequisite
  cascadeDateShift(dependsOnId).catch(() => {});

  return NextResponse.json(dep, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dependsOnId = searchParams.get("dependsOnId");

  if (!dependsOnId) {
    return NextResponse.json(
      { error: "dependsOnId query param is required" },
      { status: 400 }
    );
  }

  await prisma.taskDependency.deleteMany({
    where: {
      taskId: params.id,
      dependsOnId,
    },
  });

  return NextResponse.json({ success: true });
}
