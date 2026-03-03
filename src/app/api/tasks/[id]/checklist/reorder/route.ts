import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemIds } = body;

  if (!Array.isArray(itemIds)) {
    return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
  }

  // Update sortOrder for each item based on array index
  await prisma.$transaction(
    itemIds.map((id: string, index: number) =>
      prisma.checklistItem.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  const items = await prisma.checklistItem.findMany({
    where: { taskId: params.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(items);
}
