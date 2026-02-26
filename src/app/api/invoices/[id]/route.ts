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

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

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

  if (body.status !== undefined) updateData.status = body.status;
  if (body.clientId !== undefined) updateData.clientId = body.clientId;
  if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
  if (body.dateIssued !== undefined) updateData.dateIssued = new Date(body.dateIssued);
  if (body.dueDate !== undefined) updateData.dueDate = new Date(body.dueDate);
  if (body.lineItems !== undefined) updateData.lineItems = body.lineItems;
  if (body.subtotal !== undefined) updateData.subtotal = Number(body.subtotal);
  if (body.tax !== undefined) updateData.tax = Number(body.tax);
  if (body.total !== undefined) updateData.total = Number(body.total);
  if (body.paymentDate !== undefined) {
    updateData.paymentDate = body.paymentDate ? new Date(body.paymentDate) : null;
  }
  if (body.notes !== undefined) updateData.notes = body.notes;

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.invoice.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
