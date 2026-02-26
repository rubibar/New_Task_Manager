import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  calculateProjectHealthScore,
  recalculateProjectHealthScore,
} from "@/lib/health-scores";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await calculateProjectHealthScore(params.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to calculate health score for project ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to calculate health score" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recalculateProjectHealthScore(params.id);
    const result = await calculateProjectHealthScore(params.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Failed to recalculate health score for project ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to recalculate health score" },
      { status: 500 }
    );
  }
}
