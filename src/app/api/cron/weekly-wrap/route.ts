import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { startOfWeek } from "date-fns";

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
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You write a weekly wrap-up message in Hebrew for a 3-person animation studio Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana.
This runs Wednesday afternoon before Thursday's planning meeting.
Be warm, concise, direct. Max 2 emojis total.
Format:
- Quick recap: how many tasks completed this week, by who
- Highlight anything still open that's urgent or overdue
- One short nudge or encouragement for the team heading into planning
Keep it under 1000 characters.`,
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
    });
  } catch (error) {
    console.error("Weekly wrap cron failed:", error);
    return NextResponse.json({ error: "Weekly wrap failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
