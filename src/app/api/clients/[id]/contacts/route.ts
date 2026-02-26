import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contacts = await prisma.clientContact.findMany({
    where: { clientId: params.id },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(contacts);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role, email, phone, notes, isPrimary } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Contact name is required" },
      { status: 400 }
    );
  }

  // If marking as primary, unset other primary contacts for this client
  if (isPrimary) {
    await prisma.clientContact.updateMany({
      where: { clientId: params.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.clientContact.create({
    data: {
      clientId: params.id,
      name: name.trim(),
      role: role || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      isPrimary: isPrimary || false,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
