import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { startOfWeek, endOfWeek } from "date-fns";

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
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
        deadline: { gte: weekStart, lte: weekEnd },
      },
      include: {
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { displayScore: "desc" },
    });

    if (tasks.length === 0) {
      await sendMessage(CHAT_ID, "בוקר טוב! אין משימות עם דדליין השבוע 🎉");
      return NextResponse.json({ success: true, sent: true, taskCount: 0 });
    }

    // Group by assignee
    const byOwner: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      const name = task.owner?.name ?? "Unassigned";
      if (!byOwner[name]) byOwner[name] = [];
      byOwner[name].push(task);
    }

    const taskSummary = JSON.stringify(
      Object.entries(byOwner).map(([owner, ownerTasks]) => ({
        owner,
        tasks: ownerTasks.map((t) => ({
          title: t.title,
          project: t.project?.name ?? null,
          status: t.status,
          priority: t.priority,
          deadline: t.deadline?.toISOString().split("T")[0] ?? null,
          emergency: t.emergency,
        })),
      }))
    );

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You write daily standup messages in Hebrew for a 3-person animation studio Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana.
Be warm, concise, direct. Max 2 emojis total.
Format:
- Greeting
- Per person: what they have this week (use bullet points)
- Call out anything urgent
- End with one open question to the group to spark discussion
Keep it under 800 characters.`,
      messages: [
        {
          role: "user",
          content: `Today: ${now.toISOString().split("T")[0]}\nTasks due this week by assignee:\n${taskSummary}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    await sendMessage(CHAT_ID, textBlock.text);

    return NextResponse.json({ success: true, sent: true, taskCount: tasks.length });
  } catch (error) {
    console.error("Morning standup cron failed:", error);
    return NextResponse.json({ error: "Standup failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
