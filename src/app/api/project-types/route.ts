import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const types = await prisma.projectType.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.projectType.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Project type already exists" }, { status: 409 });
  }

  const type = await prisma.projectType.create({
    data: { name: name.trim() },
  });

  return NextResponse.json(type, { status: 201 });
}
