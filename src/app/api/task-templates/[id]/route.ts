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
  const { name, category, defaultPriority, estimatedHours, checklistItems } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (category !== undefined) updateData.category = category;
  if (defaultPriority !== undefined) updateData.defaultPriority = defaultPriority || null;
  if (estimatedHours !== undefined)
    updateData.estimatedHours = estimatedHours != null ? Number(estimatedHours) : null;

  const template = await prisma.taskTemplate.update({
    where: { id: params.id },
    data: updateData,
    include: { checklistItems: { orderBy: { sortOrder: "asc" } } },
  });

  // Replace checklist items if provided (delete-and-recreate)
  if (checklistItems !== undefined) {
    await prisma.templateChecklistItem.deleteMany({
      where: { templateId: params.id },
    });
    if (checklistItems.length > 0) {
      await prisma.templateChecklistItem.createMany({
        data: checklistItems.map(
          (item: { text: string }, index: number) => ({
            templateId: params.id,
            text: item.text,
            sortOrder: index,
          })
        ),
      });
    }
    // Re-fetch with updated checklist
    const updated = await prisma.taskTemplate.findUnique({
      where: { id: params.id },
      include: { checklistItems: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(template);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.taskTemplate.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
