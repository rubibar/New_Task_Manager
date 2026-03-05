import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { startOfDay, endOfDay, addDays } from "date-fns";

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
    const todayStart = startOfDay(now);
    const tomorrowEnd = endOfDay(addDays(now, 1));

    const tasks = await prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        deadline: { gte: todayStart, lte: tomorrowEnd },
      },
      include: {
        owner: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { deadline: "asc" },
    });

    if (tasks.length === 0) {
      return NextResponse.json({ success: true, sent: false, reason: "no tasks due" });
    }

    const todayEnd = endOfDay(now);
    const lines: string[] = ["⚠️ *Deadline Alert*\n"];

    for (const task of tasks) {
      const owner = task.owner?.name ?? "Unassigned";
      const project = task.project?.name ? ` (${task.project.name})` : "";
      const isToday = task.deadline! <= todayEnd;
      const urgency = isToday ? "📍 היום" : "📅 מחר";

      lines.push(`${urgency} *${task.title}*${project}`);
      lines.push(`   → ${owner} | ${task.priority.replace(/_/g, " ").toLowerCase()}`);
    }

    await sendMessage(CHAT_ID, lines.join("\n"));

    return NextResponse.json({ success: true, sent: true, alertCount: tasks.length });
  } catch (error) {
    console.error("Deadline alert cron failed:", error);
    return NextResponse.json({ error: "Deadline alert failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
