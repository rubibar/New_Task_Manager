import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { Prisma } from "@prisma/client";

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

    const [tasks, users, velocityLogs] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
          OR: [
            { deadline: { gte: weekStart, lte: weekEnd } },
            { deadline: null, priority: { in: ["URGENT_IMPORTANT", "IMPORTANT_NOT_URGENT"] } },
          ],
        },
        include: {
          owner: { select: { id: true, name: true } },
          project: { select: { name: true } },
        },
        orderBy: { displayScore: "desc" },
      }),
      prisma.user.findMany({ select: { id: true, name: true } }),
      // Get recent velocity for estimation
      prisma.velocityLog.findMany({
        orderBy: { completedAt: "desc" },
        take: 30,
      }),
    ]);

    if (tasks.length === 0) {
      await sendMessage(CHAT_ID, "בוקר טוב! אין משימות פתוחות לשבוע הזה 🎉");
      return NextResponse.json({ success: true, sent: true, taskCount: 0 });
    }

    // Calculate average velocity per person for day suggestions
    const avgDaysByPerson: Record<string, number> = {};
    for (const v of velocityLogs) {
      if (!avgDaysByPerson[v.assignee]) avgDaysByPerson[v.assignee] = 0;
      avgDaysByPerson[v.assignee] += v.actualDays ?? 1;
    }
    for (const name of Object.keys(avgDaysByPerson)) {
      const count = velocityLogs.filter((v) => v.assignee === name).length;
      avgDaysByPerson[name] = avgDaysByPerson[name] / count;
    }

    // Work days this week: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
    const workDays = Array.from({ length: 5 }, (_, i) => ({
      date: format(addDays(weekStart, i), "yyyy-MM-dd"),
      dayName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"][i],
      dayNameHe: ["ראשון", "שני", "שלישי", "רביעי", "חמישי"][i],
    }));

    // Suggest day assignments based on priority and workload spread
    const tasksByOwner: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      const name = task.owner?.name ?? "Unassigned";
      if (!tasksByOwner[name]) tasksByOwner[name] = [];
      tasksByOwner[name].push(task);
    }

    const suggestedPlan: { taskTitle: string; owner: string; suggestedDay: string; priority: string; project: string | null; deadline: string | null }[] = [];

    for (const [owner, ownerTasks] of Object.entries(tasksByOwner)) {
      // Spread tasks across work days, heaviest first
      const sorted = [...ownerTasks].sort((a, b) => b.displayScore - a.displayScore);
      for (let i = 0; i < sorted.length; i++) {
        const task = sorted[i];
        // If task has a deadline this week, suggest the day before
        let suggestedDay: string;
        if (task.deadline && task.deadline <= weekEnd) {
          const deadlineDay = task.deadline.getDay(); // 0=Sun
          const targetDay = Math.max(0, deadlineDay - 1);
          suggestedDay = workDays[Math.min(targetDay, 4)].dayNameHe;
        } else {
          // Spread evenly across the week
          suggestedDay = workDays[i % 5].dayNameHe;
        }

        suggestedPlan.push({
          taskTitle: task.title,
          owner,
          suggestedDay,
          priority: task.priority,
          project: task.project?.name ?? null,
          deadline: task.deadline?.toISOString().split("T")[0] ?? null,
        });
      }
    }

    const planData = JSON.stringify({
      weekStart: weekStart.toISOString().split("T")[0],
      weekEnd: weekEnd.toISOString().split("T")[0],
      workDays,
      teamMembers: users.map((u) => u.name),
      totalTasks: tasks.length,
      suggestedPlan,
      avgVelocity: avgDaysByPerson,
    });

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return NextResponse.json({ error: "Anthropic not configured" }, { status: 503 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You write a Sunday sprint planning message in Hebrew for Replica Studio's Telegram group.
Team: Rubi Barazani, Gilad Rozenkoff, Dana. Work week: Sun-Thu.
You are Replica, the studio's AI manager.

Format:
- Opening: "תכנון שבועי" header with the week dates
- For each team member, list their tasks with suggested days in a clean format:
  * Use bullet points with the task name, suggested day, and priority indicator
  * If velocity data shows tasks take longer than estimated, mention it briefly
- Total estimated hours vs capacity (if available)
- End with: "יש שינויים לתוכנית? תגיבו 'מאשר' כדי לנעול אותה."

Keep it under 2000 characters. Max 2 emojis.`,
      messages: [{ role: "user", content: planData }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No AI response" }, { status: 500 });
    }

    await sendMessage(CHAT_ID, textBlock.text);

    // Save the plan (unapproved) so it can be approved later
    await prisma.weeklyPlan.create({
      data: {
        chatId: String(CHAT_ID),
        weekStart,
        plan: suggestedPlan as unknown as Prisma.InputJsonValue,
        approved: false,
      },
    });

    return NextResponse.json({ success: true, sent: true, taskCount: tasks.length, planCreated: true });
  } catch (error) {
    console.error("Morning standup cron failed:", error);
    return NextResponse.json({ error: "Standup failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
