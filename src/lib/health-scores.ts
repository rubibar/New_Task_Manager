import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { HealthScoreFactor, HealthScoreResult } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function grade(score: number): HealthScoreResult["grade"] {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function makeFactor(
  name: string,
  score: number,
  weight: number,
  detail: string
): HealthScoreFactor {
  const clamped = clamp(Math.round(score), 0, 100);
  return {
    name,
    score: clamped,
    weight,
    weighted: Math.round(clamped * weight * 100) / 100,
    detail,
  };
}

function buildResult(
  factors: HealthScoreFactor[],
  previousScore: number | null
): HealthScoreResult {
  const overall = clamp(
    Math.round(factors.reduce((sum, f) => sum + f.weighted, 0)),
    0,
    100
  );
  const trend =
    previousScore !== null && previousScore !== undefined
      ? Math.round((overall - previousScore) * 100) / 100
      : 0;
  return { overall, factors, trend, grade: grade(overall) };
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function daysAgo(date: Date): number {
  return daysBetween(date, new Date());
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// PROJECT HEALTH SCORE
// ---------------------------------------------------------------------------

/**
 * Calculate the health score for a single project.
 * Returns the result without persisting it.
 */
export async function calculateProjectHealthScore(
  projectId: string
): Promise<HealthScoreResult> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      tasks: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          projectId: true,
        },
      },
      deliverables: {
        select: {
          id: true,
          status: true,
          dueDate: true,
        },
      },
      milestones: {
        select: {
          id: true,
          completed: true,
          dueDate: true,
        },
      },
    },
  });

  const now = new Date();
  const tasks = project.tasks;
  const deliverables = project.deliverables;
  const milestones = project.milestones;

  // -----------------------------------------------------------------------
  // 1. Timeline Adherence (30%)
  // -----------------------------------------------------------------------
  let timelineScore: number;
  let timelineDetail: string;

  if (
    project.status === "COMPLETED" ||
    project.status === "ARCHIVED"
  ) {
    timelineScore = 100;
    timelineDetail = "Project completed";
  } else if (!project.targetFinishDate) {
    timelineScore = 70;
    timelineDetail = "No target finish date set";
  } else {
    const start = project.startDate ?? project.createdAt;
    const end = project.targetFinishDate;
    const totalDuration = Math.max(daysBetween(start, end), 1);
    const elapsed = daysBetween(start, now);
    const timelineProgress = clamp(elapsed / totalDuration, 0, 1.5);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === "DONE").length;
    const taskCompletion = totalTasks > 0 ? doneTasks / totalTasks : 0;

    const timelinePct = Math.round(timelineProgress * 100);
    const taskPct = Math.round(taskCompletion * 100);

    if (timelineProgress > 1) {
      // Past target date
      const overrun = timelineProgress - 1;
      timelineScore = clamp(30 - overrun * 50, 0, 30);
    } else if (taskCompletion >= timelineProgress) {
      // Ahead of or on schedule
      const surplus = taskCompletion - timelineProgress;
      timelineScore = clamp(80 + surplus * 40, 80, 100);
    } else {
      // Behind schedule — the bigger the gap, the worse the score
      const gap = timelineProgress - taskCompletion;
      timelineScore = clamp(80 - gap * 120, 20, 80);
    }

    timelineDetail = `${timelinePct}% through timeline, ${taskPct}% tasks complete`;
  }

  const f1 = makeFactor(
    "Timeline Adherence",
    timelineScore,
    0.3,
    timelineDetail
  );

  // -----------------------------------------------------------------------
  // 2. Task Completion Rate (20%)
  // -----------------------------------------------------------------------
  let taskScore: number;
  let taskDetail: string;

  if (tasks.length === 0) {
    taskScore = 50;
    taskDetail = "No tasks created yet";
  } else {
    const doneTasks = tasks.filter((t) => t.status === "DONE").length;
    taskScore = Math.round((doneTasks / tasks.length) * 100);
    taskDetail = `${doneTasks}/${tasks.length} tasks complete (${taskScore}%)`;
  }

  const f2 = makeFactor("Task Completion Rate", taskScore, 0.2, taskDetail);

  // -----------------------------------------------------------------------
  // 3. Budget Health (20%)
  // -----------------------------------------------------------------------
  let budgetScore: number;
  let budgetDetail: string;

  if (!project.budget) {
    budgetScore = 70;
    budgetDetail = "No budget set";
  } else {
    // Aggregate time entries for all tasks in this project
    const timeAgg = await prisma.timeEntry.aggregate({
      where: {
        task: { projectId },
        duration: { not: null },
      },
      _sum: { duration: true },
    });

    const totalSeconds = timeAgg._sum.duration ?? 0;
    const totalHours = totalSeconds / 3600;

    // Determine effective rate
    let rate: number;
    if (project.hourlyRate && project.hourlyRate > 0) {
      rate = project.hourlyRate;
    } else if (project.shiftRate && project.shiftRate > 0) {
      // shiftRate is per 8-hour shift
      rate = project.shiftRate / 8;
    } else {
      rate = 0;
    }

    const spent = totalHours * rate;
    const budget = project.budget;

    if (rate === 0 && totalHours === 0) {
      budgetScore = 80;
      budgetDetail = `Budget ${formatCurrency(budget)}, no time tracked yet`;
    } else if (rate === 0) {
      budgetScore = 70;
      budgetDetail = `Budget ${formatCurrency(budget)}, no rate configured (${Math.round(totalHours)}h tracked)`;
    } else {
      const ratio = spent / budget;
      if (ratio <= 0.8) {
        budgetScore = 100;
      } else if (ratio <= 1.0) {
        // 80% - 100% of budget: scale from 100 down to 80
        budgetScore = 100 - (ratio - 0.8) * 100;
      } else if (ratio <= 1.1) {
        // 100% - 110%: scale from 80 down to 50
        budgetScore = 80 - (ratio - 1.0) * 300;
      } else if (ratio <= 1.25) {
        // 110% - 125%: scale from 50 down to 20
        budgetScore = 50 - (ratio - 1.1) * 200;
      } else {
        budgetScore = 20;
      }

      const pct = Math.round(ratio * 100);
      budgetDetail = `${formatCurrency(spent)} / ${formatCurrency(budget)} spent (${pct}%)`;
    }
  }

  const f3 = makeFactor("Budget Health", budgetScore, 0.2, budgetDetail);

  // -----------------------------------------------------------------------
  // 4. Deliverable Status (15%)
  // -----------------------------------------------------------------------
  let deliverableScore: number;
  let deliverableDetail: string;

  if (deliverables.length === 0) {
    deliverableScore = 70;
    deliverableDetail = "No deliverables defined";
  } else {
    const completedStatuses = ["APPROVED", "DELIVERED"] as const;
    const completed = deliverables.filter((d) =>
      (completedStatuses as readonly string[]).includes(d.status)
    ).length;
    const overdue = deliverables.filter(
      (d) =>
        !(completedStatuses as readonly string[]).includes(d.status) &&
        d.dueDate < now
    ).length;
    const onTrack = deliverables.length - overdue;

    // Base score from completion ratio
    const completionRatio = completed / deliverables.length;
    deliverableScore = completionRatio * 80 + 20;

    // Heavy penalty for overdue deliverables
    const overduePenalty = overdue * 20;
    deliverableScore = clamp(deliverableScore - overduePenalty, 0, 100);

    const parts: string[] = [];
    parts.push(`${onTrack}/${deliverables.length} deliverables on track`);
    if (overdue > 0) parts.push(`${overdue} overdue`);
    deliverableDetail = parts.join(", ");
  }

  const f4 = makeFactor(
    "Deliverable Status",
    deliverableScore,
    0.15,
    deliverableDetail
  );

  // -----------------------------------------------------------------------
  // 5. Milestone Progress (10%)
  // -----------------------------------------------------------------------
  let milestoneScore: number;
  let milestoneDetail: string;

  if (milestones.length === 0) {
    milestoneScore = 70;
    milestoneDetail = "No milestones defined";
  } else {
    const completed = milestones.filter((m) => m.completed).length;
    const overdue = milestones.filter(
      (m) => !m.completed && m.dueDate < now
    ).length;

    const completionRatio = completed / milestones.length;
    milestoneScore = completionRatio * 80 + 20;

    // Penalty for overdue milestones
    const overduePenalty = overdue * 25;
    milestoneScore = clamp(milestoneScore - overduePenalty, 0, 100);

    const parts: string[] = [];
    parts.push(`${completed}/${milestones.length} milestones complete`);
    if (overdue > 0) parts.push(`${overdue} overdue`);
    milestoneDetail = parts.join(", ");
  }

  const f5 = makeFactor(
    "Milestone Progress",
    milestoneScore,
    0.1,
    milestoneDetail
  );

  // -----------------------------------------------------------------------
  // 6. Task Activity (5%)
  // -----------------------------------------------------------------------
  let activityScore: number;
  let activityDetail: string;

  if (tasks.length === 0) {
    activityScore = 50;
    activityDetail = "No tasks to measure activity";
  } else {
    // Find most recent task update
    const sortedTasks = [...tasks].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    const lastUpdate = sortedTasks[0].updatedAt;
    const daysSinceUpdate = daysAgo(lastUpdate);

    if (daysSinceUpdate < 1) {
      activityScore = 100;
      activityDetail = "Activity today";
    } else if (daysSinceUpdate < 3) {
      activityScore = 90;
      activityDetail = `Last activity ${Math.round(daysSinceUpdate)} day${Math.round(daysSinceUpdate) === 1 ? "" : "s"} ago`;
    } else if (daysSinceUpdate < 7) {
      activityScore = 70;
      activityDetail = `Last activity ${Math.round(daysSinceUpdate)} days ago`;
    } else if (daysSinceUpdate < 14) {
      activityScore = 40;
      activityDetail = `Last activity ${Math.round(daysSinceUpdate)} days ago`;
    } else {
      activityScore = 15;
      activityDetail = `Last activity ${Math.round(daysSinceUpdate)} days ago`;
    }
  }

  const f6 = makeFactor("Task Activity", activityScore, 0.05, activityDetail);

  // -----------------------------------------------------------------------
  // Build result
  // -----------------------------------------------------------------------
  return buildResult(
    [f1, f2, f3, f4, f5, f6],
    project.healthScore
  );
}

// ---------------------------------------------------------------------------
// CLIENT HEALTH SCORE
// ---------------------------------------------------------------------------

/**
 * Calculate the health score for a single client.
 * Returns the result without persisting it.
 */
export async function calculateClientHealthScore(
  clientId: string
): Promise<HealthScoreResult> {
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      invoices: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          paymentDate: true,
          total: true,
          dateIssued: true,
        },
        orderBy: { dateIssued: "desc" },
      },
      projects: {
        select: {
          id: true,
          status: true,
          healthScore: true,
          tasks: {
            select: { id: true, status: true },
          },
        },
      },
      communications: {
        select: {
          id: true,
          date: true,
          type: true,
        },
        orderBy: { date: "desc" },
      },
      contacts: {
        select: { id: true },
      },
    },
  });

  const now = new Date();
  const invoices = client.invoices;
  const projects = client.projects;
  const communications = client.communications;

  // -----------------------------------------------------------------------
  // 1. Payment Timeliness (30%)
  // -----------------------------------------------------------------------
  let paymentScore: number;
  let paymentDetail: string;

  // Only consider non-DRAFT, non-CANCELLED invoices
  const relevantInvoices = invoices.filter(
    (inv) => inv.status !== "DRAFT" && inv.status !== "CANCELLED"
  );

  if (relevantInvoices.length === 0) {
    paymentScore = 70;
    paymentDetail = "No invoices yet";
  } else {
    const paidInvoices = relevantInvoices.filter(
      (inv) => inv.status === "PAID"
    );
    const overdueInvoices = relevantInvoices.filter(
      (inv) => inv.status === "OVERDUE"
    );
    const sentInvoices = relevantInvoices.filter(
      (inv) => inv.status === "SENT"
    );

    // Count how many paid invoices were paid on time
    let paidOnTime = 0;
    for (const inv of paidInvoices) {
      if (inv.paymentDate && inv.paymentDate <= inv.dueDate) {
        paidOnTime++;
      } else if (inv.paymentDate) {
        // Paid late — still counts partially
        paidOnTime += 0.5;
      }
    }

    // Base score from on-time payment ratio among paid invoices
    const onTimeRatio =
      paidInvoices.length > 0 ? paidOnTime / paidInvoices.length : 0;
    const paidRatio =
      paidInvoices.length / relevantInvoices.length;

    // Combine: paid ratio (are they paying?) + on-time ratio (are they paying promptly?)
    paymentScore = paidRatio * 50 + onTimeRatio * 50;

    // Heavy penalty for currently overdue invoices
    const overduePenalty = overdueInvoices.length * 20;
    paymentScore = clamp(paymentScore - overduePenalty, 0, 100);

    // Slight penalty for unpaid but not yet overdue (SENT) invoices
    // Only penalize if there are many outstanding
    if (sentInvoices.length > 2) {
      paymentScore = clamp(paymentScore - (sentInvoices.length - 2) * 5, 0, 100);
    }

    const parts: string[] = [];
    if (paidInvoices.length > 0) {
      parts.push(
        `${Math.round(paidOnTime)}/${paidInvoices.length} invoices paid on time`
      );
    }
    if (overdueInvoices.length > 0) {
      parts.push(`${overdueInvoices.length} overdue`);
    }
    if (parts.length === 0) {
      parts.push(`${relevantInvoices.length} invoices sent`);
    }
    paymentDetail = parts.join(", ");
  }

  const f1 = makeFactor(
    "Payment Timeliness",
    paymentScore,
    0.3,
    paymentDetail
  );

  // -----------------------------------------------------------------------
  // 2. Project Success Rate (25%)
  // -----------------------------------------------------------------------
  let projectScore: number;
  let projectDetail: string;

  const activeStatuses = [
    "ACTIVE",
    "IN_PROGRESS",
    "NOT_STARTED",
  ] as const;
  const activeProjects = projects.filter((p) =>
    (activeStatuses as readonly string[]).includes(p.status)
  );
  const completedProjects = projects.filter(
    (p) => p.status === "COMPLETED"
  );
  const relevantProjects = [...activeProjects, ...completedProjects];

  if (relevantProjects.length === 0) {
    projectScore = 50;
    projectDetail = "No projects";
  } else {
    // Try to use existing health scores first
    const projectsWithScores = relevantProjects.filter(
      (p) => p.healthScore !== null && p.healthScore !== undefined
    );

    if (projectsWithScores.length > 0) {
      const avgHealth =
        projectsWithScores.reduce((sum, p) => sum + (p.healthScore ?? 0), 0) /
        projectsWithScores.length;
      projectScore = avgHealth;

      const activeCount = activeProjects.length;
      projectDetail = `${activeCount} active project${activeCount !== 1 ? "s" : ""}, avg health ${Math.round(avgHealth)}`;
    } else {
      // Fall back to task completion rates
      let totalTasks = 0;
      let doneTasks = 0;
      for (const proj of relevantProjects) {
        totalTasks += proj.tasks.length;
        doneTasks += proj.tasks.filter((t) => t.status === "DONE").length;
      }

      if (totalTasks > 0) {
        projectScore = Math.round((doneTasks / totalTasks) * 100);
      } else {
        projectScore = 50;
      }

      const activeCount = activeProjects.length;
      projectDetail = `${activeCount} active project${activeCount !== 1 ? "s" : ""}, ${doneTasks}/${totalTasks} tasks complete`;
    }
  }

  const f2 = makeFactor(
    "Project Success Rate",
    projectScore,
    0.25,
    projectDetail
  );

  // -----------------------------------------------------------------------
  // 3. Communication Recency (20%)
  // -----------------------------------------------------------------------
  let commScore: number;
  let commDetail: string;

  if (communications.length === 0) {
    commScore = 30;
    commDetail = "No communications logged";
  } else {
    const lastComm = communications[0]; // already sorted desc
    const daysSince = daysAgo(lastComm.date);

    if (daysSince <= 7) {
      commScore = 100;
    } else if (daysSince <= 14) {
      commScore = 80;
    } else if (daysSince <= 30) {
      commScore = 60;
    } else if (daysSince <= 60) {
      commScore = 40;
    } else {
      commScore = 20;
    }

    commDetail = `Last contact ${Math.round(daysSince)} day${Math.round(daysSince) === 1 ? "" : "s"} ago (${lastComm.type.replace("_", " ")})`;
  }

  const f3 = makeFactor(
    "Communication Recency",
    commScore,
    0.2,
    commDetail
  );

  // -----------------------------------------------------------------------
  // 4. Revenue Trend (15%)
  // -----------------------------------------------------------------------
  let revenueScore: number;
  let revenueDetail: string;

  // Split invoices into two halves chronologically to compare trends
  const paidOrSentInvoices = invoices.filter(
    (inv) =>
      inv.status === "PAID" ||
      inv.status === "SENT" ||
      inv.status === "OVERDUE"
  );

  if (paidOrSentInvoices.length < 2) {
    revenueScore = 50;
    revenueDetail = "Insufficient invoice data for trend";
  } else {
    // Sort by dateIssued ascending for trend analysis
    const sorted = [...paidOrSentInvoices].sort(
      (a, b) => a.dateIssued.getTime() - b.dateIssued.getTime()
    );
    const midpoint = Math.floor(sorted.length / 2);
    const olderHalf = sorted.slice(0, midpoint);
    const newerHalf = sorted.slice(midpoint);

    const olderTotal = olderHalf.reduce((sum, inv) => sum + inv.total, 0);
    const newerTotal = newerHalf.reduce((sum, inv) => sum + inv.total, 0);

    // Normalize by number of invoices in each half to account for different counts
    const olderAvg = olderHalf.length > 0 ? olderTotal / olderHalf.length : 0;
    const newerAvg = newerHalf.length > 0 ? newerTotal / newerHalf.length : 0;

    if (olderAvg === 0 && newerAvg === 0) {
      revenueScore = 50;
      revenueDetail = "No revenue recorded";
    } else if (olderAvg === 0) {
      revenueScore = 90;
      revenueDetail = "New revenue stream";
    } else {
      const changePercent = ((newerAvg - olderAvg) / olderAvg) * 100;

      if (changePercent > 20) {
        revenueScore = 95;
        revenueDetail = `Revenue growing (+${Math.round(changePercent)}% vs previous period)`;
      } else if (changePercent > 5) {
        revenueScore = 80;
        revenueDetail = `Revenue growing (+${Math.round(changePercent)}% vs previous period)`;
      } else if (changePercent >= -5) {
        revenueScore = 65;
        revenueDetail = "Revenue stable";
      } else if (changePercent >= -20) {
        revenueScore = 40;
        revenueDetail = `Revenue declining (${Math.round(changePercent)}% vs previous period)`;
      } else {
        revenueScore = 20;
        revenueDetail = `Revenue declining (${Math.round(changePercent)}% vs previous period)`;
      }
    }
  }

  const f4 = makeFactor("Revenue Trend", revenueScore, 0.15, revenueDetail);

  // -----------------------------------------------------------------------
  // 5. Engagement Level (10%)
  // -----------------------------------------------------------------------
  let engagementScore: number;
  let engagementDetail: string;

  const activeProjectCount = activeProjects.length;

  // Communication frequency: count communications in last 90 days
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentComms = communications.filter(
    (c) => c.date >= ninetyDaysAgo
  ).length;

  // Contact completeness
  const hasContacts = client.contacts.length > 0;

  // Score components
  let projectPoints: number;
  if (activeProjectCount >= 3) {
    projectPoints = 40;
  } else if (activeProjectCount >= 2) {
    projectPoints = 35;
  } else if (activeProjectCount >= 1) {
    projectPoints = 25;
  } else {
    projectPoints = 5;
  }

  // Communication frequency (per month equivalent)
  const commsPerMonth = (recentComms / 90) * 30;
  let commPoints: number;
  if (commsPerMonth >= 4) {
    commPoints = 40; // Weekly+
  } else if (commsPerMonth >= 2) {
    commPoints = 30; // Biweekly
  } else if (commsPerMonth >= 1) {
    commPoints = 20; // Monthly
  } else if (recentComms > 0) {
    commPoints = 10;
  } else {
    commPoints = 0;
  }

  const contactPoints = hasContacts ? 20 : 0;

  engagementScore = clamp(projectPoints + commPoints + contactPoints, 0, 100);

  // Build detail string
  const commFrequency =
    commsPerMonth >= 4
      ? "weekly"
      : commsPerMonth >= 2
        ? "biweekly"
        : commsPerMonth >= 1
          ? "monthly"
          : "infrequent";

  engagementDetail = `${activeProjectCount} active project${activeProjectCount !== 1 ? "s" : ""}, ${commFrequency} communication`;

  const f5 = makeFactor(
    "Engagement Level",
    engagementScore,
    0.1,
    engagementDetail
  );

  // -----------------------------------------------------------------------
  // Build result
  // -----------------------------------------------------------------------
  return buildResult(
    [f1, f2, f3, f4, f5],
    client.healthScore
  );
}

// ---------------------------------------------------------------------------
// PERSISTENCE HELPERS
// ---------------------------------------------------------------------------

/**
 * Calculate and persist the health score for a single project.
 */
export async function recalculateProjectHealthScore(
  projectId: string
): Promise<void> {
  const result = await calculateProjectHealthScore(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      healthScore: result.overall,
      healthScoreFactors: result.factors as unknown as Prisma.InputJsonValue,
      healthScoreTrend: result.trend,
      healthScoreUpdatedAt: new Date(),
    },
  });
}

/**
 * Calculate and persist the health score for a single client.
 */
export async function recalculateClientHealthScore(
  clientId: string
): Promise<void> {
  const result = await calculateClientHealthScore(clientId);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      healthScore: result.overall,
      healthScoreFactors: result.factors as unknown as Prisma.InputJsonValue,
      healthScoreTrend: result.trend,
      healthScoreUpdatedAt: new Date(),
    },
  });
}

/**
 * Recalculate health scores for ALL projects that are not archived.
 */
export async function recalculateAllProjectHealthScores(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: {
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });

  for (const project of projects) {
    try {
      await recalculateProjectHealthScore(project.id);
    } catch (error) {
      console.error(
        `Failed to recalculate health score for project ${project.id}:`,
        error
      );
    }
  }
}

/**
 * Recalculate health scores for ALL clients that are not archived.
 */
export async function recalculateAllClientHealthScores(): Promise<void> {
  const clients = await prisma.client.findMany({
    where: {
      status: { not: "ARCHIVED" },
    },
    select: { id: true },
  });

  for (const client of clients) {
    try {
      await recalculateClientHealthScore(client.id);
    } catch (error) {
      console.error(
        `Failed to recalculate health score for client ${client.id}:`,
        error
      );
    }
  }
}
