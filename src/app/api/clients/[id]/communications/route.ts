import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Prisma.CommunicationLogWhereInput = {
    clientId: params.id,
  };

  if (type) {
    where.type = type as Prisma.EnumCommunicationLogTypeFilter;
  }

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) {
      (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.date as Prisma.DateTimeFilter).lte = new Date(dateTo);
    }
  }

  const communications = await prisma.communicationLog.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(communications);
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
  const { type, subject, description, date, participants, followUpDate } = body;

  if (!type || !subject?.trim()) {
    return NextResponse.json(
      { error: "Type and subject are required" },
      { status: 400 }
    );
  }

  const communication = await prisma.communicationLog.create({
    data: {
      clientId: params.id,
      type,
      subject: subject.trim(),
      description: description || undefined,
      date: date ? new Date(date) : new Date(),
      participants: participants || [],
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
    },
  });

  return NextResponse.json(communication, { status: 201 });
}
