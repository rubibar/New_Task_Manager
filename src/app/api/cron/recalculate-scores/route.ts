import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAllScores } from "@/lib/scoring";

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
    // Get all active tasks
    const tasks = await prisma.task.findMany({
      where: { status: { not: "DONE" } },
    });

    // Get user capacity map
    const users = await prisma.user.findMany({
      select: { id: true, atCapacity: true },
    });
    const capacityMap = new Map(users.map((u) => [u.id, u.atCapacity]));

    // Calculate all scores
    const scores = calculateAllScores(tasks, capacityMap);

    // Batch update all scores
    await Promise.all(
      scores.map((s) =>
        prisma.task.update({
          where: { id: s.taskId },
          data: {
            rawScore: s.rawScore,
            displayScore: s.displayScore,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      tasksUpdated: scores.length,
    });
  } catch (error) {
    console.error("Score recalculation failed:", error);
    return NextResponse.json(
      { error: "Recalculation failed" },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggers during development
export async function GET(request: NextRequest) {
  return POST(request);
}
