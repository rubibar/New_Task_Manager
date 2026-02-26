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
  const projectTypeId = searchParams.get("projectTypeId");

  const where = projectTypeId ? { projectTypeId } : {};

  const templates = await prisma.folderTemplate.findMany({
    where,
    include: { projectType: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectTypeId, structure } = body;

  if (!projectTypeId || !structure) {
    return NextResponse.json(
      { error: "projectTypeId and structure are required" },
      { status: 400 }
    );
  }

  const template = await prisma.folderTemplate.create({
    data: {
      projectTypeId,
      structure,
    },
    include: { projectType: true },
  });

  return NextResponse.json(template, { status: 201 });
}
