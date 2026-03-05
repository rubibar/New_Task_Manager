import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { subDays, startOfDay, endOfDay } from "date-fns";

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
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));

    const [openTasks, completedYesterday, users] = await Promise.all([
      prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
        orderBy: { displayScore: "desc" },
      }),
      prisma.task.findMany({
        where: {
          status: "DONE",
          updatedAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        include: {
          owner: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      prisma.user.findMany({ select: { name: true } }),
    ]);

    // Group open tasks by assignee
    const byOwner: Record<string, typeof openTasks> = {};
    for (const task of openTasks) {
      const name = task.owner?.name ?? "Unassigned";
      if (!byOwner[name]) byOwner[name] = [];
      byOwner[name].push(task);
    }

    const overdue = openTasks.filter(
      (t) => t.deadline && t.deadline < now
    );

    const briefData = JSON.stringify({
      date: now.toISOString().split("T")[0],
      teamMembers: users.map((u) => u.name),
      completedYesterday: completedYesterday.map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        project: t.project?.name ?? null,
      })),
      tasksByPerson: Object.entries(byOwner).map(([owner, tasks]) => ({
        owner,
        total: tasks.length,
        topPriority: tasks.slice(0, 5).map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          project: t.project?.name ?? null,
          deadline: t.deadline?.toISOString().split("T")[0] ?? null,
          score: t.displayScore,
        })),
      })),
      overdue: overdue.map((t) => ({
        title: t.title,
        owner: t.owner?.name,
        deadline: t.deadline?.toISOString().split("T")[0] ?? null,
        priority: t.priority,
      })),
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You write the daily morning brief in Hebrew for Replica Studio's Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana. Work week: Sun-Thu.
You are Replica, the studio's AI manager. Be warm, sharp, and concise. Max 2 emojis.
Format:
- One-line summary of the day ahead
- Each person's top 2-3 priorities for today (bullet points)
- Any overdue items needing immediate attention
- One proactive suggestion or question for the team
Keep it under 1200 characters.`,
      messages: [{ role: "user", content: briefData }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    await sendMessage(CHAT_ID, textBlock.text);

    return NextResponse.json({
      success: true,
      sent: true,
      openCount: openTasks.length,
      overdueCount: overdue.length,
    });
  } catch (error) {
    console.error("Daily brief cron failed:", error);
    return NextResponse.json({ error: "Daily brief failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
