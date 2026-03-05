import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { startOfWeek } from "date-fns";

// Personal Telegram chat IDs for DMs
const PERSONAL_CHAT_IDS: Record<string, string | undefined> = {
  "rubi@replica.works": process.env.TELEGRAM_RUBI_ID,
  "gilad@replica.works": process.env.TELEGRAM_GILAD_ID,
  "dana@replica.works": process.env.TELEGRAM_DANA_ID,
};

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
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    let sentCount = 0;

    for (const user of users) {
      const chatId = PERSONAL_CHAT_IDS[user.email.toLowerCase()];
      if (!chatId) continue;

      const [completedThisWeek, openTasks, overdueTasks, velocityLogs] = await Promise.all([
        prisma.task.findMany({
          where: {
            ownerId: user.id,
            status: "DONE",
            updatedAt: { gte: weekStart },
          },
          include: { project: { select: { name: true } } },
        }),
        prisma.task.findMany({
          where: {
            ownerId: user.id,
            status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
          },
          include: { project: { select: { name: true } } },
          orderBy: { displayScore: "desc" },
        }),
        prisma.task.findMany({
          where: {
            ownerId: user.id,
            status: { not: "DONE" },
            deadline: { lt: now },
          },
          include: { project: { select: { name: true } } },
        }),
        prisma.velocityLog.findMany({
          where: {
            assignee: user.name,
            completedAt: { gte: weekStart },
          },
        }),
      ]);

      const avgCompletionDays = velocityLogs.length > 0
        ? velocityLogs.reduce((sum, v) => sum + (v.actualDays ?? 0), 0) / velocityLogs.length
        : null;

      const reviewData = JSON.stringify({
        name: user.name,
        completedThisWeek: completedThisWeek.map((t) => ({
          title: t.title,
          project: t.project?.name ?? null,
        })),
        openTasks: openTasks.map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: t.project?.name ?? null,
          deadline: t.deadline?.toISOString().split("T")[0] ?? null,
          score: t.displayScore,
        })),
        overdueTasks: overdueTasks.map((t) => ({
          title: t.title,
          deadline: t.deadline?.toISOString().split("T")[0] ?? null,
          project: t.project?.name ?? null,
        })),
        completedCount: completedThisWeek.length,
        openCount: openTasks.length,
        overdueCount: overdueTasks.length,
        avgCompletionDays: avgCompletionDays ? avgCompletionDays.toFixed(1) : null,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You write a personal weekly review in Hebrew for a team member at Replica Studio.
This is a PRIVATE message — be personal and supportive. Use their first name.
Format:
- Quick stats: completed, open, overdue counts
- Highlight achievements this week
- Flag overdue tasks that need attention
- If velocity data exists, mention their pace
- One personal insight or encouragement
- End with: "איך את/ה מרגיש/ה לגבי השבוע הבא?"
Keep it under 800 characters. Max 2 emojis.`,
        messages: [{ role: "user", content: reviewData }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;

      await sendMessage(Number(chatId), textBlock.text);
      sentCount++;
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
    });
  } catch (error) {
    console.error("Personal review cron failed:", error);
    return NextResponse.json({ error: "Personal review failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
