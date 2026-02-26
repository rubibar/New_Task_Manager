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
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType) {
    return NextResponse.json(
      { error: "entityType is required" },
      { status: 400 }
    );
  }

  const cache = await prisma.aIInsightCache.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId: entityId || "",
      },
    },
  });

  if (!cache) {
    return NextResponse.json(null);
  }

  return NextResponse.json(cache);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entityType, entityId, inputHash, data } = body;

  if (!entityType || !inputHash || data === undefined) {
    return NextResponse.json(
      { error: "entityType, inputHash, and data are required" },
      { status: 400 }
    );
  }

  const resolvedEntityId = entityId || "";

  const cache = await prisma.aIInsightCache.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId: resolvedEntityId,
      },
    },
    update: {
      inputHash,
      data,
      generatedAt: new Date(),
    },
    create: {
      entityType,
      entityId: resolvedEntityId,
      inputHash,
      data,
    },
  });

  return NextResponse.json(cache, { status: 201 });
}
