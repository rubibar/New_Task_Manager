import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";

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
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    const twoMonthsAgoStart = startOfMonth(subMonths(now, 2));
    const twoMonthsAgoEnd = endOfMonth(subMonths(now, 2));

    const [
      completedLastMonth,
      completedPrevMonth,
      velocityLastMonth,
      velocityPrevMonth,
      slippedTasks,
      users,
    ] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: "DONE",
          updatedAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true, clientName: true } },
        },
      }),
      prisma.task.count({
        where: {
          status: "DONE",
          updatedAt: { gte: twoMonthsAgoStart, lte: twoMonthsAgoEnd },
        },
      }),
      prisma.velocityLog.findMany({
        where: { completedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.velocityLog.findMany({
        where: { completedAt: { gte: twoMonthsAgoStart, lte: twoMonthsAgoEnd } },
      }),
      // Tasks that were overdue or had deadline pushes
      prisma.task.findMany({
        where: {
          status: "DONE",
          updatedAt: { gte: lastMonthStart, lte: lastMonthEnd },
          deadline: { not: null },
        },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.user.findMany({ select: { name: true } }),
    ]);

    // Per-person breakdown
    const byPerson: Record<string, number> = {};
    for (const t of completedLastMonth) {
      const name = t.owner?.name ?? "Unknown";
      byPerson[name] = (byPerson[name] ?? 0) + 1;
    }

    // Per-client breakdown
    const byClient: Record<string, { count: number; tasks: string[] }> = {};
    for (const t of completedLastMonth) {
      const client = t.project?.clientName ?? t.project?.name ?? "No project";
      if (!byClient[client]) byClient[client] = { count: 0, tasks: [] };
      byClient[client].count++;
      if (byClient[client].tasks.length < 5) {
        byClient[client].tasks.push(t.title);
      }
    }

    // Velocity analysis
    const avgActual = velocityLastMonth.length > 0
      ? velocityLastMonth.reduce((sum, v) => sum + (v.actualDays ?? 0), 0) / velocityLastMonth.length
      : null;
    const withEstimates = velocityLastMonth.filter((v) => v.estimatedDays != null && v.estimatedDays > 0);
    const avgEstimated = withEstimates.length > 0
      ? withEstimates.reduce((sum, v) => sum + (v.estimatedDays ?? 0), 0) / withEstimates.length
      : null;
    const prevAvgActual = velocityPrevMonth.length > 0
      ? velocityPrevMonth.reduce((sum, v) => sum + (v.actualDays ?? 0), 0) / velocityPrevMonth.length
      : null;

    // Slipped tasks (completed after deadline)
    const slipped = slippedTasks.filter(
      (t) => t.deadline && t.updatedAt > t.deadline
    );

    const monthName = lastMonthStart.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

    const reportData = JSON.stringify({
      month: monthName,
      totalCompleted: completedLastMonth.length,
      prevMonthCompleted: completedPrevMonth,
      byPerson,
      byClient: Object.entries(byClient).map(([name, data]) => ({
        name,
        count: data.count,
        keyTasks: data.tasks,
      })),
      velocity: {
        avgActualDays: avgActual ? avgActual.toFixed(1) : null,
        avgEstimatedDays: avgEstimated ? avgEstimated.toFixed(1) : null,
        prevMonthAvgDays: prevAvgActual ? prevAvgActual.toFixed(1) : null,
        totalTracked: velocityLastMonth.length,
      },
      slippedCount: slipped.length,
      slippedTasks: slipped.slice(0, 5).map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        project: t.project?.name,
        daysLate: t.deadline ? Math.round((t.updatedAt.getTime() - t.deadline.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      })),
      teamMembers: users.map((u) => u.name),
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You write a monthly studio report in Hebrew for Replica Studio's Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana.
You are Replica, the studio's AI manager. Be clear, professional, but warm.
Format the report with clear sections:
- Header with month name
- Total tasks completed (with comparison to previous month: up/down %)
- Per-person breakdown (who completed how many)
- Per-client/project breakdown (top clients with key deliverables)
- Velocity: average completion time vs estimates, trend vs previous month
- Slipped tasks: how many were late, notable ones
- One closing insight or trend observation
Keep it under 2500 characters. Max 3 emojis.`,
      messages: [{ role: "user", content: reportData }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    await sendMessage(CHAT_ID, textBlock.text);

    return NextResponse.json({
      success: true,
      sent: true,
      completedCount: completedLastMonth.length,
      slippedCount: slipped.length,
    });
  } catch (error) {
    console.error("Monthly report cron failed:", error);
    return NextResponse.json({ error: "Monthly report failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
