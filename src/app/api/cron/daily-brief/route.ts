import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

const CHAT_ID = Number(process.env.TELEGRAM_GROUP_CHAT_ID);

const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT_IMPORTANT: 4,
  IMPORTANT_NOT_URGENT: 2,
  URGENT_NOT_IMPORTANT: 2,
  NEITHER: 1,
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
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));

    const [openTasks, completedYesterday, users] = await Promise.all([
      prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } },
        include: {
          owner: { select: { id: true, name: true } },
          project: { select: { name: true, clientName: true } },
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
      prisma.user.findMany({ select: { id: true, name: true } }),
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

    // --- WORKLOAD ANALYSIS ---
    const workloadByPerson: { name: string; userId: string; taskCount: number; weightedLoad: number; lowestPriorityTask: string | null }[] = [];
    let totalWeightedLoad = 0;

    for (const user of users) {
      const userTasks = openTasks.filter((t) => t.owner?.id === user.id);
      const weighted = userTasks.reduce(
        (sum, t) => sum + (PRIORITY_WEIGHTS[t.priority] ?? 1),
        0
      );
      totalWeightedLoad += weighted;

      const lowestPriority = userTasks
        .sort((a, b) => (PRIORITY_WEIGHTS[a.priority] ?? 1) - (PRIORITY_WEIGHTS[b.priority] ?? 1))[0];

      workloadByPerson.push({
        name: user.name,
        userId: user.id,
        taskCount: userTasks.length,
        weightedLoad: weighted,
        lowestPriorityTask: lowestPriority?.title ?? null,
      });
    }

    // Calculate percentages and find imbalances
    const workloadAnalysis = workloadByPerson.map((w) => ({
      ...w,
      percentage: totalWeightedLoad > 0 ? Math.round((w.weightedLoad / totalWeightedLoad) * 100) : 0,
    }));

    const overloaded = workloadAnalysis.filter((w) => w.percentage > 40);
    const underloaded = workloadAnalysis
      .filter((w) => w.percentage < 25)
      .sort((a, b) => a.percentage - b.percentage);

    let workloadWarning: string | null = null;
    if (overloaded.length > 0 && underloaded.length > 0) {
      const heavy = overloaded[0];
      const light = underloaded[0];
      workloadWarning = `${heavy.name} is carrying ${heavy.percentage}% of the workload (${heavy.taskCount} tasks). Lightest: ${light.name} at ${light.percentage}%. Consider moving "${heavy.lowestPriorityTask}" to ${light.name}.`;
    }

    // Log workload for trend analysis (fire-and-forget)
    for (const w of workloadAnalysis) {
      prisma.workloadLog.create({
        data: {
          userId: w.userId,
          userName: w.name,
          taskCount: w.taskCount,
          weightedLoad: w.weightedLoad,
          percentage: w.percentage,
        },
      }).catch(() => {});
    }

    // --- CLIENT HEALTH ANALYSIS ---
    const clientProjects = await prisma.project.findMany({
      where: {
        clientName: { not: null },
        status: { in: ["ACTIVE", "IN_PROGRESS"] },
      },
      select: { id: true, name: true, clientName: true },
    });

    const clientHealthAlerts: string[] = [];

    for (const project of clientProjects) {
      const projectTasks = openTasks.filter(
        (t) => t.project?.name === project.name
      );
      if (projectTasks.length === 0) continue;

      const overdueTasks = projectTasks.filter(
        (t) => t.deadline && t.deadline < now
      );
      const overduePercent = Math.round(
        (overdueTasks.length / projectTasks.length) * 100
      );

      // Count deadline pushes from Decision records
      const deadlinePushes = await prisma.decision.count({
        where: {
          summary: { contains: project.name, mode: "insensitive" },
          createdAt: { gte: subDays(now, 30) },
        },
      });

      // Days since last completed task in this project
      const lastCompleted = await prisma.task.findFirst({
        where: { projectId: project.id, status: "DONE" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      const daysSinceCompletion = lastCompleted
        ? Math.floor((now.getTime() - lastCompleted.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if (overduePercent >= 30 || deadlinePushes >= 2) {
        const parts = [`${project.name} (${project.clientName})`];
        if (overduePercent >= 30) parts.push(`${overdueTasks.length} overdue tasks (${overduePercent}%)`);
        if (deadlinePushes >= 2) parts.push(`${deadlinePushes} deadline pushes this month`);
        if (daysSinceCompletion && daysSinceCompletion > 7) parts.push(`${daysSinceCompletion} days since last completion`);
        clientHealthAlerts.push(parts.join(" — "));
      }
    }

    // --- BUFFER WARNING (capacity check) ---
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

    const thisWeekTasks = openTasks.filter(
      (t) => t.deadline && t.deadline >= weekStart && t.deadline <= weekEnd
    );
    const totalEstimatedHours = thisWeekTasks.reduce(
      (sum, t) => sum + (t.estimatedHours ?? 2), // default 2h if no estimate
      0
    );
    const WEEKLY_CAPACITY = 90; // 6 productive hours × 5 days × 3 people
    const capacityPercent = Math.round((totalEstimatedHours / WEEKLY_CAPACITY) * 100);

    let bufferWarning: string | null = null;
    if (totalEstimatedHours > WEEKLY_CAPACITY * 0.75) {
      bufferWarning = `~${Math.round(totalEstimatedHours)} estimated hours this week on ${WEEKLY_CAPACITY}h capacity (${capacityPercent}%). Consider deferring lower-priority tasks.`;
    }

    // --- APPROVED PLAN CONTEXT ---
    const approvedPlan = await prisma.weeklyPlan.findFirst({
      where: {
        chatId: String(CHAT_ID),
        weekStart: { gte: weekStart },
        approved: true,
      },
      orderBy: { createdAt: "desc" },
    });

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
      workloadAnalysis: workloadAnalysis.map((w) => ({
        name: w.name,
        taskCount: w.taskCount,
        weightedLoad: w.weightedLoad,
        percentage: w.percentage,
      })),
      workloadWarning,
      clientHealthAlerts: clientHealthAlerts.length > 0 ? clientHealthAlerts : null,
      bufferWarning,
      capacityPercent,
      approvedPlan: approvedPlan ? approvedPlan.plan : null,
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
- If workloadWarning is provided, include a workload rebalancing suggestion naturally
- If clientHealthAlerts are provided, flag unhealthy client projects with a brief recommendation
- If bufferWarning is provided, warn about capacity overflow and suggest deferring something
- If approvedPlan is provided, reference today's planned tasks from the weekly plan
- One proactive suggestion or question for the team
Keep it under 1500 characters.`,
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
      workloadImbalance: overloaded.length > 0,
      clientAlerts: clientHealthAlerts.length,
    });
  } catch (error) {
    console.error("Daily brief cron failed:", error);
    return NextResponse.json({ error: "Daily brief failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
