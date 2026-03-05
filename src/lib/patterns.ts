import { prisma } from "@/lib/prisma";
import { subWeeks } from "date-fns";

export interface PatternInsights {
  overdueByPerson: { name: string; adminOverdueCount: number; totalOverdueCount: number }[];
  pileUpDays: { day: string; count: number }[];
  summary: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function analyzePatterns(): Promise<PatternInsights> {
  const fourWeeksAgo = subWeeks(new Date(), 4);

  // Get tasks from the last 4 weeks that were overdue (completed after deadline or still open past deadline)
  const [overdueTasks, completedTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        deadline: { lt: new Date(), gte: fourWeeksAgo },
        status: { not: "DONE" },
      },
      include: { owner: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: {
        status: "DONE",
        updatedAt: { gte: fourWeeksAgo },
        deadline: { not: null },
      },
      include: { owner: { select: { name: true } } },
    }),
  ]);

  // Also count tasks that were completed late
  const completedLate = completedTasks.filter(
    (t) => t.deadline && t.updatedAt > t.deadline
  );
  const allOverdue = [...overdueTasks, ...completedLate];

  // Pattern 1: Overdue tasks by person (with admin breakdown)
  const byPerson: Record<string, { admin: number; total: number }> = {};
  for (const t of allOverdue) {
    const name = t.owner?.name ?? "Unknown";
    if (!byPerson[name]) byPerson[name] = { admin: 0, total: 0 };
    byPerson[name].total++;
    if (t.type === "ADMIN") byPerson[name].admin++;
  }
  const overdueByPerson = Object.entries(byPerson)
    .map(([name, counts]) => ({
      name,
      adminOverdueCount: counts.admin,
      totalOverdueCount: counts.total,
    }))
    .sort((a, b) => b.totalOverdueCount - a.totalOverdueCount);

  // Pattern 2: Which days of the week have most deadlines (pile-ups)
  const dayCount: Record<number, number> = {};
  const tasksWithDeadlines = await prisma.task.findMany({
    where: {
      deadline: { gte: fourWeeksAgo },
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
    },
    select: { deadline: true },
  });
  for (const t of tasksWithDeadlines) {
    if (t.deadline) {
      const day = t.deadline.getDay();
      dayCount[day] = (dayCount[day] ?? 0) + 1;
    }
  }
  const pileUpDays = Object.entries(dayCount)
    .map(([day, count]) => ({ day: DAY_NAMES[Number(day)], count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Build human-readable summary for Claude
  const lines: string[] = [];
  for (const p of overdueByPerson) {
    if (p.adminOverdueCount >= 2) {
      lines.push(`${p.name} has had ${p.adminOverdueCount} overdue admin tasks in the last 4 weeks.`);
    }
    if (p.totalOverdueCount >= 3) {
      lines.push(`${p.name} has had ${p.totalOverdueCount} overdue tasks total in the last 4 weeks.`);
    }
  }
  if (pileUpDays.length > 0 && pileUpDays[0].count >= 3) {
    lines.push(`${pileUpDays[0].day} tends to have the most deadline pile-ups (${pileUpDays[0].count} tasks in 4 weeks).`);
  }

  return {
    overdueByPerson,
    pileUpDays,
    summary: lines.length > 0 ? lines.join("\n") : "No significant patterns detected.",
  };
}
