import { NextRequest, NextResponse } from "next/server";
import { recalculateAndPersistScores, calculateRawScore } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";
import { getRemainingWorkingHours, getTodoAgingHours } from "@/lib/business-hours";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "true";

  try {
    await recalculateAndPersistScores();

    if (debug) {
      // Return detailed score breakdown for auditing
      const tasks = await prisma.task.findMany({
        where: { status: { not: "DONE" } },
        include: {
          project: { select: { name: true } },
        },
        orderBy: { displayScore: "desc" },
      });

      const breakdowns = tasks.map((task) => {
        const breakdown = calculateRawScore(task);
        const remainingHours = task.deadline
          ? getRemainingWorkingHours(task.deadline)
          : null;
        const agingHours = getTodoAgingHours(task.todoSince);

        return {
          title: task.title,
          project: task.project?.name ?? "(none)",
          status: task.status,
          priority: task.priority,
          type: task.type,
          deadline: task.deadline?.toISOString().split("T")[0] ?? null,
          remainingWorkHours: remainingHours != null ? Math.round(remainingHours) : null,
          todoAgingHours: Math.round(agingHours),
          factors: {
            deadlineProximity: breakdown.deadlineProximity,
            priority: breakdown.priority,
            taskType: breakdown.taskType,
            status: breakdown.status,
            aging: breakdown.aging,
            boosts: breakdown.boosts,
          },
          rawScore: breakdown.rawScore,
        };
      });

      // Distribution summary
      const scores = breakdowns.map((b) => b.rawScore);
      const distribution = {
        count: scores.length,
        min: Math.min(...scores),
        max: Math.max(...scores),
        avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        ranges: {
          "0-20": scores.filter((s) => s < 20).length,
          "20-40": scores.filter((s) => s >= 20 && s < 40).length,
          "40-60": scores.filter((s) => s >= 40 && s < 60).length,
          "60-80": scores.filter((s) => s >= 60 && s < 80).length,
          "80-100": scores.filter((s) => s >= 80).length,
        },
      };

      return NextResponse.json({
        success: true,
        distribution,
        tasks: breakdowns,
      });
    }

    return NextResponse.json({ success: true });
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
