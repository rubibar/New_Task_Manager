export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatScore(score: number): string {
  return Math.round(score).toString();
}

export function getHeatColor(score: number): string {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function getHeatBgClass(score: number): string {
  if (score >= 70) return "bg-red-500/10 border-red-500/30";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/30";
  return "bg-slate-500/10 border-slate-500/20";
}

export function getHeatTextClass(score: number): string {
  if (score >= 70) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-slate-500";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "TODO":
      return "bg-slate-400";
    case "IN_PROGRESS":
      return "bg-blue-500";
    case "IN_REVIEW":
      return "bg-amber-500";
    case "DONE":
      return "bg-green-500";
    default:
      return "bg-slate-400";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "TODO":
      return "To Do";
    case "IN_PROGRESS":
      return "In Progress";
    case "IN_REVIEW":
      return "In Review";
    case "DONE":
      return "Done";
    default:
      return status;
  }
}

export function getTypeLabel(type: string): string {
  switch (type) {
    case "CLIENT":
      return "Client";
    case "INTERNAL_RD":
      return "R&D";
    case "ADMIN":
      return "Admin";
    default:
      return type;
  }
}

export function getTypeColor(type: string): string {
  switch (type) {
    case "CLIENT":
      return "bg-red-200 text-red-800";
    case "INTERNAL_RD":
      return "bg-lime-200 text-lime-800";
    case "ADMIN":
      return "bg-violet-200 text-violet-800";
    default:
      return "bg-slate-200 text-slate-800";
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case "URGENT_IMPORTANT":
      return "Urgent & Important";
    case "IMPORTANT_NOT_URGENT":
      return "Important";
    case "URGENT_NOT_IMPORTANT":
      return "Urgent";
    case "NEITHER":
      return "Low";
    default:
      return priority;
  }
}

export function formatDeadline(deadline: Date | null): string {
  if (!deadline) return "No deadline";
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    const overdueDays = Math.abs(days);
    if (overdueDays === 0) return "Overdue today";
    return `${overdueDays}d overdue`;
  }

  if (days === 0) {
    if (hours <= 0) return "Due now";
    return `${hours}h left`;
  }
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days}d left`;
  return deadline.toLocaleDateString("en-IL", {
    month: "short",
    day: "numeric",
  });
}

// --- Color Utilities ---

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const DEFAULT_NO_PROJECT_COLOR = "#D4A574"; // warm amber/sand for unassigned tasks

/**
 * Get task color based on project color, phase category, and optional date position.
 *
 * Two-axis color system:
 * - Axis 1 (phase): PRE_PRODUCTION lighter, PRODUCTION base, POST_PRODUCTION darker, ADMIN desaturated
 * - Axis 2 (date): tasks closer to project start are lighter, tasks further are darker (within ±8L range)
 *
 * @param dateProgress — 0..1 representing how far the task is through the project timeline.
 *   0 = project start, 1 = project end. Omit or pass undefined for no date gradient.
 */
export function getTaskColor(
  projectColor: string | null | undefined,
  category: string | null | undefined,
  dateProgress?: number | null
): string {
  const baseHex = projectColor || DEFAULT_NO_PROJECT_COLOR;

  const hsl = hexToHSL(baseHex);

  // Phase-based lightness shift
  let lightnessShift = 0;
  let saturationMultiplier = 1;
  switch (category) {
    case "PRE_PRODUCTION":
      lightnessShift = 30;
      break;
    case "PRODUCTION":
      lightnessShift = 0;
      break;
    case "POST_PRODUCTION":
      lightnessShift = -20;
      break;
    case "ADMIN":
      saturationMultiplier = 0.5;
      break;
  }

  // Date-based lightness shift: ±8L range within the phase
  // Early tasks (+8L lighter), late tasks (-8L darker)
  let dateLightnessShift = 0;
  if (dateProgress != null && projectColor) {
    // dateProgress 0→1 maps to +8→-8 lightness
    dateLightnessShift = 8 - dateProgress * 16;
  }

  const finalL = Math.max(10, Math.min(95, hsl.l + lightnessShift + dateLightnessShift));
  const finalS = Math.max(0, hsl.s * saturationMultiplier);

  // If no category and no date progress, return base color unchanged
  if (!category && dateProgress == null) return baseHex;

  return hslToHex(hsl.h, finalS, finalL);
}

/**
 * Compute date progress (0..1) for a task within its project timeline.
 * Returns null if insufficient data (no project dates or no task dates).
 */
export function getDateProgress(
  taskStartDate: Date | string | null | undefined,
  taskDeadline: Date | string | null | undefined,
  projectStartDate: Date | string | null | undefined,
  projectEndDate: Date | string | null | undefined
): number | null {
  if (!taskStartDate || !projectStartDate || !projectEndDate) return null;

  const projStart = new Date(projectStartDate).getTime();
  const projEnd = new Date(projectEndDate).getTime();
  const projDuration = projEnd - projStart;

  if (projDuration <= 0) return null;

  // Use the task's midpoint for a stable position
  const tStart = new Date(taskStartDate).getTime();
  const tEnd = taskDeadline ? new Date(taskDeadline).getTime() : tStart;
  const taskMid = (tStart + tEnd) / 2;

  return Math.max(0, Math.min(1, (taskMid - projStart) / projDuration));
}

export function getCategoryLabel(category: string | null | undefined): string {
  switch (category) {
    case "PRE_PRODUCTION": return "Pre-Production";
    case "PRODUCTION": return "Production";
    case "POST_PRODUCTION": return "Post-Production";
    case "ADMIN": return "Admin";
    default: return "";
  }
}

export const ALLOWED_EMAILS = [
  "dana@replica.works",
  "rubi@replica.works",
  "gilad@replica.works",
];

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
