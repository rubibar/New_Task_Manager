import { NextRequest, NextResponse } from "next/server";
import {
  recalculateAllProjectHealthScores,
  recalculateAllClientHealthScores,
} from "@/lib/health-scores";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Count entities before recalculation for reporting
    const [projectCount, clientCount] = await Promise.all([
      prisma.project.count({ where: { status: { not: "ARCHIVED" } } }),
      prisma.client.count({ where: { status: { not: "ARCHIVED" } } }),
    ]);

    await recalculateAllProjectHealthScores();
    await recalculateAllClientHealthScores();

    return NextResponse.json({
      success: true,
      projects: projectCount,
      clients: clientCount,
    });
  } catch (error) {
    console.error("Health score recalculation failed:", error);
    return NextResponse.json(
      { error: "Health score recalculation failed" },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggers during development
export async function GET(request: NextRequest) {
  return POST(request);
}
