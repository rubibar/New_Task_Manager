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

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: {
      contacts: {
        orderBy: { isPrimary: "desc" },
      },
      projects: {
        include: {
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      invoices: {
        orderBy: { dateIssued: "desc" },
      },
      communications: {
        orderBy: { date: "desc" },
        take: 20,
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
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

  if (body.name !== undefined) updateData.name = body.name;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.clientType !== undefined) updateData.clientType = body.clientType;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.industry !== undefined) updateData.industry = body.industry;
  if (body.website !== undefined) updateData.website = body.website;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.notes !== undefined) updateData.notes = body.notes;

  const client = await prisma.client.update({
    where: { id: params.id },
    data: updateData,
    include: {
      contacts: true,
      _count: {
        select: {
          projects: true,
          invoices: true,
          communications: true,
        },
      },
    },
  });

  return NextResponse.json(client);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.client.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
