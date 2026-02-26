import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Prisma.InvoiceWhereInput = {};

  if (status) {
    where.status = status as Prisma.EnumInvoiceStatusFilter;
  }

  if (clientId) {
    where.clientId = clientId;
  }

  if (dateFrom || dateTo) {
    where.dateIssued = {};
    if (dateFrom) {
      (where.dateIssued as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.dateIssued as Prisma.DateTimeFilter).lte = new Date(dateTo);
    }
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { dateIssued: "desc" },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    clientId,
    projectId,
    status,
    dateIssued,
    dueDate,
    lineItems,
    subtotal,
    tax,
    total,
    notes,
  } = body;

  if (!clientId || !dueDate || !lineItems || !Array.isArray(lineItems)) {
    return NextResponse.json(
      { error: "clientId, dueDate, and lineItems are required" },
      { status: 400 }
    );
  }

  // Auto-generate invoice number: query last invoice, parse number, increment
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNumber = 1;
  if (lastInvoice?.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const invoiceNumber = `INV-${String(nextNumber).padStart(3, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      clientId,
      projectId: projectId || undefined,
      status: status || undefined,
      dateIssued: dateIssued ? new Date(dateIssued) : new Date(),
      dueDate: new Date(dueDate),
      lineItems,
      subtotal: Number(subtotal) || 0,
      tax: Number(tax) || 0,
      total: Number(total) || 0,
      notes: notes || undefined,
    },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
