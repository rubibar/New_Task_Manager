import type { Task, TaskType, Priority } from "@prisma/client";
import {
  getRemainingWorkingHours,
  getUrgencyMultiplier,
  getTodoAgingHours,
  isSundayRDTime,
  isThursdayMeetingMode,
} from "./business-hours";
import type { ScoreBreakdown } from "@/types";

// Base weights by task type
const BASE_WEIGHTS: Record<TaskType, number> = {
  CLIENT: 30,
  INTERNAL_RD: 15,
  ADMIN: 5,
};

// User priority weights
const PRIORITY_WEIGHTS: Record<Priority, number> = {
  URGENT_IMPORTANT: 40,
  IMPORTANT_NOT_URGENT: 25,
  URGENT_NOT_IMPORTANT: 15,
  NEITHER: 5,
};

/**
 * Calculate the raw score for a single task.
 * RS = (W_base + W_user + Aging) x U + Boosts
 */
export function calculateRawScore(
  task: Task,
  ownerAtCapacity: boolean = false
): ScoreBreakdown {
  // If task is DONE or frozen during Thursday meeting, return 0
  if (task.status === "DONE") {
    return {
      baseWeight: 0,
      userPriority: 0,
      aging: 0,
      urgencyMultiplier: 0,
      subtotal: 0,
      boosts: { inReview: 0, emergency: 0, sundayRD: 0 },
      rawScore: 0,
      displayScore: 0,
    };
  }

  const baseWeight = BASE_WEIGHTS[task.type];
  const userPriority = PRIORITY_WEIGHTS[task.priority];

  // Aging: +2 per 24 working hours in TODO
  const todoHours = task.status === "TODO" ? getTodoAgingHours(task.todoSince) : 0;
  const aging = Math.floor(todoHours / 24) * 2;

  // Urgency multiplier based on remaining working hours to deadline
  const remainingHours = getRemainingWorkingHours(task.deadline);
  const urgencyMultiplier = getUrgencyMultiplier(remainingHours);

  // Subtotal before boosts
  const subtotal = (baseWeight + userPriority + aging) * urgencyMultiplier;

  // Boosts
  let inReviewBoost = 0;
  let emergencyBoost = 0;
  let sundayRDBoost = 0;

  if (task.status === "IN_REVIEW") {
    inReviewBoost = 50;
  }

  if (task.emergency) {
    emergencyBoost = 100;
  }

  if (isSundayRDTime() && task.type === "INTERNAL_RD") {
    sundayRDBoost = 100;
  }

  // Capacity penalty: when owner is at capacity, ADMIN tasks get -20
  let capacityPenalty = 0;
  if (ownerAtCapacity && task.type === "ADMIN") {
    capacityPenalty = -20;
  }

  const rawScore = Math.max(
    0,
    subtotal + inReviewBoost + emergencyBoost + sundayRDBoost + capacityPenalty
  );

  return {
    baseWeight,
    userPriority,
    aging,
    urgencyMultiplier,
    subtotal,
    boosts: {
      inReview: inReviewBoost,
      emergency: emergencyBoost,
      sundayRD: sundayRDBoost,
    },
    rawScore,
    displayScore: 0, // Will be normalized after all tasks are scored
  };
}

/**
 * Calculate scores for all active tasks and normalize to 0-100.
 * Returns an array of { taskId, rawScore, displayScore }.
 */
export function calculateAllScores(
  tasks: Task[],
  userCapacityMap: Map<string, boolean>
): Array<{ taskId: string; rawScore: number; displayScore: number }> {
  // If Thursday meeting mode is active, freeze all scores
  const frozen = isThursdayMeetingMode();

  // Calculate raw scores for all non-DONE tasks
  const scored = tasks
    .filter((t) => t.status !== "DONE")
    .map((task) => {
      if (frozen && task.isFrozen) {
        // During freeze, keep existing scores
        return {
          taskId: task.id,
          rawScore: task.rawScore,
          displayScore: task.displayScore,
        };
      }

      const ownerCapacity = userCapacityMap.get(task.ownerId) ?? false;
      const breakdown = calculateRawScore(task, ownerCapacity);

      return {
        taskId: task.id,
        rawScore: breakdown.rawScore,
        displayScore: 0,
      };
    });

  // Find max raw score for normalization
  const maxRaw = Math.max(...scored.map((s) => s.rawScore), 1);

  // Normalize: DisplayScore = (RS_task / RS_max) * 100
  return scored.map((s) => ({
    ...s,
    displayScore: Math.round((s.rawScore / maxRaw) * 100),
  }));
}
