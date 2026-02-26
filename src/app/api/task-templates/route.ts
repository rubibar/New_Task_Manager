import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.taskTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, category, defaultPriority, estimatedHours } = body;

  if (!name?.trim() || !category) {
    return NextResponse.json(
      { error: "name and category are required" },
      { status: 400 }
    );
  }

  const template = await prisma.taskTemplate.create({
    data: {
      name: name.trim(),
      category,
      defaultPriority: defaultPriority || undefined,
      estimatedHours: estimatedHours != null ? Number(estimatedHours) : undefined,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
