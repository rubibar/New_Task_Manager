import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { subDays, addDays } from "date-fns";

const CHAT_ID = Number(process.env.TELEGRAM_GROUP_CHAT_ID);
const MAX_ALERTS = 3;

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
    const threeDaysAgo = subDays(now, 3);
    const twoDaysFromNow = addDays(now, 2);

    // Stale in-progress tasks: not updated in 3+ days
    const staleInProgress = await prisma.task.findMany({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: threeDaysAgo },
      },
      include: { owner: { select: { name: true } } },
      orderBy: { displayScore: "desc" },
    });

    // Untouched TODOs due within 2 days
    const urgentTodos = await prisma.task.findMany({
      where: {
        status: "TODO",
        deadline: { gte: now, lte: twoDaysFromNow },
      },
      include: { owner: { select: { name: true } } },
      orderBy: { deadline: "asc" },
    });

    const alerts: string[] = [];

    for (const task of staleInProgress) {
      if (alerts.length >= MAX_ALERTS) break;
      const owner = task.owner?.name ?? "someone";
      const daysSinceUpdate = Math.floor(
        (now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      alerts.push(
        `*${task.title}* hasn't been updated in ${daysSinceUpdate} days \u2014 ${owner}, still on track?`
      );
    }

    for (const task of urgentTodos) {
      if (alerts.length >= MAX_ALERTS) break;
      const owner = task.owner?.name ?? "someone";
      const dueDate = task.deadline!.toISOString().split("T")[0];
      alerts.push(
        `*${task.title}* is due ${dueDate} and still in TODO \u2014 ${owner}, planning to start?`
      );
    }

    if (alerts.length === 0) {
      return NextResponse.json({ success: true, sent: false, reason: "no stale tasks" });
    }

    const message = alerts.join("\n\n");
    await sendMessage(CHAT_ID, message);

    return NextResponse.json({
      success: true,
      sent: true,
      alertCount: alerts.length,
    });
  } catch (error) {
    console.error("Stale tasks cron failed:", error);
    return NextResponse.json({ error: "Stale tasks check failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
