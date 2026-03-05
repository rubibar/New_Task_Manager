import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { analyzePatterns } from "@/lib/patterns";
import { startOfWeek, addDays } from "date-fns";

const CHAT_ID = Number(process.env.TELEGRAM_GROUP_CHAT_ID);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday

    const [completedThisWeek, stillOpen] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: "DONE",
          updatedAt: { gte: weekStart },
        },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
        },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { displayScore: "desc" },
      }),
    ]);

    // Analyze 4-week patterns
    const patterns = await analyzePatterns();

    // --- VELOCITY ANALYSIS ---
    const velocityLogs = await prisma.velocityLog.findMany({
      where: { completedAt: { gte: weekStart } },
    });

    let velocitySummary: string | null = null;
    if (velocityLogs.length > 0) {
      const avgActual = velocityLogs.reduce((sum, v) => sum + (v.actualDays ?? 0), 0) / velocityLogs.length;

      const withEstimates = velocityLogs.filter((v) => v.estimatedDays != null && v.estimatedDays > 0);
      if (withEstimates.length > 0) {
        const avgEstimated = withEstimates.reduce((sum, v) => sum + (v.estimatedDays ?? 0), 0) / withEstimates.length;
        const ratio = avgActual / avgEstimated;
        if (ratio > 1.2) {
          velocitySummary = `Average task completion: ${avgActual.toFixed(1)} days (estimated ${avgEstimated.toFixed(1)} — tasks are taking ${Math.round((ratio - 1) * 100)}% longer than planned)`;
        } else if (ratio < 0.8) {
          velocitySummary = `Average task completion: ${avgActual.toFixed(1)} days (estimated ${avgEstimated.toFixed(1)} — team is delivering ${Math.round((1 - ratio) * 100)}% faster than expected!)`;
        } else {
          velocitySummary = `Average task completion: ${avgActual.toFixed(1)} days — estimates are on point this week`;
        }
      } else {
        velocitySummary = `Average task completion: ${avgActual.toFixed(1)} days this week (${velocityLogs.length} tasks)`;
      }

      // Per-person velocity
      const byPerson: Record<string, { count: number; totalDays: number }> = {};
      for (const v of velocityLogs) {
        if (!byPerson[v.assignee]) byPerson[v.assignee] = { count: 0, totalDays: 0 };
        byPerson[v.assignee].count++;
        byPerson[v.assignee].totalDays += v.actualDays ?? 0;
      }
      const personVelocity = Object.entries(byPerson).map(([name, data]) => ({
        name,
        completed: data.count,
        avgDays: data.totalDays / data.count,
      }));
      velocitySummary += "\n" + personVelocity
        .map((p) => `${p.name}: ${p.completed} tasks, avg ${p.avgDays.toFixed(1)} days`)
        .join(", ");
    }

    // --- THURSDAY PLANNING: unplanned tasks ---
    const twoWeeksOut = addDays(now, 14);
    const unplannedTasks = await prisma.task.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        OR: [
          { deadline: null },
          { deadline: { gt: twoWeeksOut } },
        ],
      },
      include: {
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { displayScore: "desc" },
      take: 15,
    });

    const summary = JSON.stringify({
      completed: completedThisWeek.map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        project: t.project?.name ?? null,
      })),
      stillOpen: stillOpen.slice(0, 30).map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        project: t.project?.name ?? null,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline?.toISOString().split("T")[0] ?? null,
        emergency: t.emergency,
      })),
      unplannedTasks: unplannedTasks.map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        project: t.project?.name ?? null,
        priority: t.priority,
        deadline: t.deadline?.toISOString().split("T")[0] ?? null,
      })),
      patternInsights: patterns.summary,
      velocitySummary,
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `You write a weekly wrap-up AND planning facilitator message in Hebrew for a 3-person animation studio Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana.
This runs Wednesday afternoon before Thursday's planning meeting.
Be warm, concise, direct. Max 2 emojis total.
Format:
- Quick recap: how many tasks completed this week, by who
- If velocity data is provided, include the completion speed insight (estimates vs actuals)
- Highlight anything still open that's urgent or overdue
- If pattern insights are provided, weave ONE trend naturally into the message
- PLANNING SECTION: If unplannedTasks are provided, list them under a "זמן תכנון" header and ask the team to set deadlines/priorities for next week. For each unplanned task, mention who owns it and suggest it needs a deadline.
- One short nudge for the team heading into planning
Keep it under 2000 characters.`,
      messages: [
        {
          role: "user",
          content: `Week starting: ${weekStart.toISOString().split("T")[0]}\nToday: ${now.toISOString().split("T")[0]}\n\n${summary}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    await sendMessage(CHAT_ID, textBlock.text);

    return NextResponse.json({
      success: true,
      sent: true,
      completedCount: completedThisWeek.length,
      openCount: stillOpen.length,
      velocityEntries: velocityLogs.length,
    });
  } catch (error) {
    console.error("Weekly wrap cron failed:", error);
    return NextResponse.json({ error: "Weekly wrap failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
