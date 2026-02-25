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

export function formatDeadline(deadline: Date): string {
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

export const ALLOWED_EMAILS = [
  "dana@replica.works",
  "rubi@replica.works",
  "gilad@replica.works",
];

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}
