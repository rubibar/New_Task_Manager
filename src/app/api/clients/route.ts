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
  const search = searchParams.get("search");
  const status = searchParams.get("status");
  const tags = searchParams.get("tags");
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const where: Prisma.ClientWhereInput = {};

  // Filter by status
  if (status) {
    where.status = status as Prisma.EnumClientStatusFilter;
  }

  // Filter by tags (comma-separated, match any)
  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    where.tags = { hasSome: tagList };
  }

  // Search by name, email, or notes
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  // Build orderBy
  let orderBy: Prisma.ClientOrderByWithRelationInput;
  switch (sortBy) {
    case "name":
      orderBy = { name: sortOrder === "asc" ? "asc" : "desc" };
      break;
    case "revenue":
      orderBy = { invoices: { _count: sortOrder === "asc" ? "asc" : "desc" } };
      break;
    case "createdAt":
    default:
      orderBy = { createdAt: sortOrder === "asc" ? "asc" : "desc" };
      break;
  }

  const clients = await prisma.client.findMany({
    where,
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
    orderBy,
  });

  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    status,
    clientType,
    source,
    industry,
    website,
    phone,
    email,
    address,
    logoUrl,
    tags,
    notes,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Client name is required" },
      { status: 400 }
    );
  }

  const client = await prisma.client.create({
    data: {
      name: name.trim(),
      status: status || undefined,
      clientType: clientType || undefined,
      source: source || undefined,
      industry: industry || undefined,
      website: website || undefined,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      logoUrl: logoUrl || undefined,
      tags: tags || [],
      notes: notes || undefined,
    },
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

  return NextResponse.json(client, { status: 201 });
}
