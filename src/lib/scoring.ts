import type { Task, TaskType, Priority } from "@prisma/client";
import {
  getRemainingWorkingHours,
  getTodoAgingHours,
  isSundayRDTime,
  isThursdayMeetingMode,
} from "./business-hours";
import { prisma } from "@/lib/prisma";
import type { ScoreBreakdown } from "@/types";

// --- Factor 1: Deadline Proximity (0-50) ---
// Non-overdue: quadratic curve from 0..35 over 80 working hours.
// Overdue: base 35 + 2 per overdue working day, capped at 50.
// This gives a 15-point spread between barely overdue and severely overdue.
const DEADLINE_BASE_MAX = 35;
const DEADLINE_OVERDUE_CAP = 50;
const DEADLINE_HORIZON = 80; // working hours (~2 work weeks)
const OVERDUE_PER_DAY = 2; // +2 per overdue working day (8h)

function getDeadlineProximityScore(remainingHours: number): number {
  if (remainingHours >= DEADLINE_HORIZON) return 0; // >2 weeks out → 0

  if (remainingHours <= 0) {
    // Overdue: base 35 + linear bonus per overdue working day
    const overdueHours = Math.abs(remainingHours);
    const overdueDays = Math.floor(overdueHours / 8);
    const bonus = overdueDays * OVERDUE_PER_DAY;
    return Math.min(DEADLINE_OVERDUE_CAP, DEADLINE_BASE_MAX + bonus);
  }

  // Approaching deadline: steeper curve (power 2.5 instead of 2)
  const normalized = remainingHours / DEADLINE_HORIZON; // 0..1
  return Math.round(DEADLINE_BASE_MAX * Math.pow(1 - normalized, 2.5) * 10) / 10;
}

// --- Factor 2: Priority (0-25) ---
const PRIORITY_SCORES: Record<Priority, number> = {
  URGENT_IMPORTANT: 25,
  IMPORTANT_NOT_URGENT: 15,
  URGENT_NOT_IMPORTANT: 10,
  NEITHER: 3,
};

// --- Factor 3: Task Type (0-10) ---
const TYPE_SCORES: Record<TaskType, number> = {
  CLIENT: 10,
  INTERNAL_RD: 6,
  ADMIN: 3,
};

// --- Factor 4: Status (0-10) ---
const STATUS_SCORES: Record<string, number> = {
  IN_REVIEW: 10,
  IN_PROGRESS: 5,
  TODO: 0,
  DONE: 0,
};

// --- Factor 5: Aging (0-10, +1 per working day in TODO) ---
function getAgingScore(todoSince: Date | null, status: string): number {
  if (status !== "TODO") return 0;
  const todoHours = getTodoAgingHours(todoSince);
  const points = Math.floor(todoHours / 8); // +1 per 8 working hours (1 work day)
  return Math.min(points, 10);
}

/**
 * Calculate the absolute score for a single task.
 * Score = deadlineProximity + priority + taskType + status + aging + boosts
 * Range: 0-100 (no normalization needed)
 */
export function calculateRawScore(task: Task): ScoreBreakdown {
  if (task.status === "DONE") {
    return {
      deadlineProximity: 0,
      priority: 0,
      taskType: 0,
      status: 0,
      aging: 0,
      boosts: { emergency: 0, sundayRD: 0 },
      rawScore: 0,
      displayScore: 0,
    };
  }

  const deadlineProximity = task.deadline
    ? getDeadlineProximityScore(getRemainingWorkingHours(task.deadline))
    : 0;
  const priority = PRIORITY_SCORES[task.priority];
  const taskType = TYPE_SCORES[task.type];
  const status = STATUS_SCORES[task.status] ?? 0;
  const aging = getAgingScore(task.todoSince, task.status);

  const emergencyBoost = task.emergency ? 10 : 0;
  const sundayRDBoost = isSundayRDTime() && task.type === "INTERNAL_RD" ? 5 : 0;

  const rawScore = Math.min(
    100,
    deadlineProximity + priority + taskType + status + aging + emergencyBoost + sundayRDBoost
  );

  return {
    deadlineProximity,
    priority,
    taskType,
    status,
    aging,
    boosts: { emergency: emergencyBoost, sundayRD: sundayRDBoost },
    rawScore,
    displayScore: rawScore, // absolute — no normalization
  };
}

/**
 * Calculate scores for all active tasks.
 * Returns an array of { taskId, rawScore, displayScore }.
 */
export function calculateAllScores(
  tasks: Task[]
): Array<{ taskId: string; rawScore: number; displayScore: number }> {
  const frozen = isThursdayMeetingMode();

  return tasks
    .filter((t) => t.status !== "DONE")
    .map((task) => {
      if (frozen && task.isFrozen) {
        return {
          taskId: task.id,
          rawScore: task.rawScore,
          displayScore: task.displayScore,
        };
      }

      const breakdown = calculateRawScore(task);
      return {
        taskId: task.id,
        rawScore: breakdown.rawScore,
        displayScore: breakdown.displayScore,
      };
    });
}

/**
 * Recalculate scores for ALL active tasks and persist to DB.
 * Call this after any task mutation (create, update, status change, delete).
 */
export async function recalculateAndPersistScores(): Promise<void> {
  try {
    const tasks = await prisma.task.findMany({
      where: { status: { not: "DONE" } },
    });

    const scores = calculateAllScores(tasks);

    await Promise.all(
      scores.map((s) =>
        prisma.task.update({
          where: { id: s.taskId },
          data: {
            rawScore: s.rawScore,
            displayScore: s.displayScore,
          },
        })
      )
    );
  } catch (error) {
    console.error("Score recalculation failed:", error);
  }
}
