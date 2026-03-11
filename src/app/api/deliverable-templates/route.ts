import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const templates = await prisma.deliverableTemplate.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phase, sortOrder, defaultTasks, isActive } = body;

  if (!name || !phase) {
    return NextResponse.json(
      { error: "Name and phase are required" },
      { status: 400 }
    );
  }

  const template = await prisma.deliverableTemplate.create({
    data: {
      name,
      phase,
      sortOrder: sortOrder ?? 0,
      defaultTasks: defaultTasks ?? [],
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
