import { toZonedTime } from "date-fns-tz";
import {
  addDays,
  differenceInHours,
  isBefore,
  isAfter,
  startOfDay,
  getDay,
  getHours,
  setHours,
  setMinutes,
  setSeconds,
} from "date-fns";

const TZ = "Asia/Jerusalem";
const WORK_START = 10; // 10:00
const WORK_END = 18; // 18:00
const WORK_HOURS_PER_DAY = WORK_END - WORK_START; // 8 hours

// Israel work week: Sunday (0) through Thursday (4)
// Friday (5) and Saturday (6) are off
function isWorkDay(date: Date): boolean {
  const zonedDate = toZonedTime(date, TZ);
  const day = getDay(zonedDate);
  return day >= 0 && day <= 4; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
}

function getWorkStart(date: Date): Date {
  const d = startOfDay(date);
  return setSeconds(setMinutes(setHours(d, WORK_START), 0), 0);
}

function getWorkEnd(date: Date): Date {
  const d = startOfDay(date);
  return setSeconds(setMinutes(setHours(d, WORK_END), 0), 0);
}

/**
 * Calculate the remaining WORKING HOURS between now and a deadline.
 * Only counts Sun-Thu, 10:00-18:00 Israel time.
 * Returns negative if deadline is past.
 */
export function getRemainingWorkingHours(deadline: Date): number {
  const now = toZonedTime(new Date(), TZ);
  const deadlineZoned = toZonedTime(deadline, TZ);

  if (isAfter(now, deadlineZoned)) {
    // Past deadline — calculate how many working hours overdue
    return -getWorkingHoursBetween(deadlineZoned, now);
  }

  return getWorkingHoursBetween(now, deadlineZoned);
}

/**
 * Calculate working hours between two dates.
 * Counts only Sun-Thu, 10:00-18:00 Israel time.
 */
export function getWorkingHoursBetween(start: Date, end: Date): number {
  if (isAfter(start, end)) return 0;

  let totalHours = 0;
  let current = new Date(start.getTime());

  // Cap at a reasonable max to avoid infinite loops
  const maxDays = 365;
  let daysChecked = 0;

  while (isBefore(current, end) && daysChecked < maxDays) {
    if (isWorkDay(current)) {
      const dayStart = getWorkStart(current);
      const dayEnd = getWorkEnd(current);

      // Clamp current to work hours
      const effectiveStart = isAfter(current, dayStart) ? current : dayStart;
      const effectiveEnd = isBefore(end, dayEnd) ? end : dayEnd;

      if (isBefore(effectiveStart, effectiveEnd)) {
        const hours = differenceInHours(effectiveEnd, effectiveStart);
        totalHours += Math.min(hours, WORK_HOURS_PER_DAY);
      }
    }

    // Move to start of next day
    current = getWorkStart(addDays(startOfDay(current), 1));
    daysChecked++;
  }

  return totalHours;
}

/**
 * Get the urgency multiplier based on remaining working hours.
 */
export function getUrgencyMultiplier(remainingHours: number): number {
  if (remainingHours < 0) return 3.0; // Past deadline
  if (remainingHours < 8) return 2.5;
  if (remainingHours < 16) return 2.0;
  if (remainingHours <= 40) return 1.5;
  return 1.0;
}

/**
 * Calculate how many working hours a task has been in TODO status.
 */
export function getTodoAgingHours(todoSince: Date | null): number {
  if (!todoSince) return 0;
  const now = toZonedTime(new Date(), TZ);
  const todoZoned = toZonedTime(todoSince, TZ);
  return getWorkingHoursBetween(todoZoned, now);
}

/**
 * Check if the current time is during Sunday R&D Holy Time (Sun 10:00-13:00 IST).
 */
export function isSundayRDTime(): boolean {
  const now = toZonedTime(new Date(), TZ);
  const day = getDay(now);
  const hour = getHours(now);
  return day === 0 && hour >= 10 && hour < 13;
}

/**
 * Check if Thursday meeting mode should be active (Thu 14:00+ IST until end of Friday).
 */
export function isThursdayMeetingMode(): boolean {
  const now = toZonedTime(new Date(), TZ);
  const day = getDay(now);
  const hour = getHours(now);

  // Thursday 14:00 onwards
  if (day === 4 && hour >= 14) return true;
  // Friday (all day, since it's off)
  if (day === 5) return true;

  return false;
}

/**
 * Check if current time is within business hours.
 */
export function isBusinessHours(): boolean {
  const now = toZonedTime(new Date(), TZ);
  const day = getDay(now);
  const hour = getHours(now);
  return day >= 0 && day <= 4 && hour >= WORK_START && hour < WORK_END;
}
