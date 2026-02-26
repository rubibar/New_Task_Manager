import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.notes !== undefined) updateData.notes = body.notes;

  // Handle isPrimary toggle
  if (body.isPrimary !== undefined) {
    if (body.isPrimary) {
      // Unset other primary contacts for this client
      await prisma.clientContact.updateMany({
        where: { clientId: params.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    updateData.isPrimary = body.isPrimary;
  }

  const contact = await prisma.clientContact.update({
    where: { id: params.contactId },
    data: updateData,
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.clientContact.delete({ where: { id: params.contactId } });

  return NextResponse.json({ success: true });
}
