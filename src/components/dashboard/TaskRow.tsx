"use client";

import { Badge } from "@/components/ui/Badge";
import { ScoreBadge } from "@/components/tasks/ScoreBadge";
import {
  getTaskColor,
  getDateProgress,
  getStatusLabel,
  getTypeLabel,
  getTypeColor,
  formatDeadline,
} from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface TaskRowProps {
  task: TaskWithRelations;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  IN_REVIEW: "bg-amber-50 text-amber-700",
  DONE: "bg-green-50 text-green-700",
};

export function TaskRow({
  task,
  onClick,
  selectable = false,
  selected = false,
  onToggleSelect,
}: TaskRowProps) {
  const color = getTaskColor(
    task.project?.color ?? null,
    task.category ?? null,
    getDateProgress(
      task.startDate,
      task.deadline,
      task.project?.startDate,
      task.project?.targetFinishDate
    )
  );

  const now = new Date();
  const isOverdue = task.deadline && new Date(task.deadline) < now;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 hover:bg-slate-50
        cursor-pointer transition-colors group active:bg-slate-100
        ${selected ? "bg-[#C8FF00]/10" : ""}
        ${task.emergency ? "bg-red-50/30" : ""}
      `}
    >
      {/* Batch select checkbox */}
      {selectable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`w-5 h-5 sm:w-4 sm:h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            selected
              ? "bg-[#C8FF00] border-[#C8FF00]"
              : "border-slate-300 group-hover:border-slate-400"
          }`}
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </button>
      )}

      {/* Project color bar */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Mobile: stacked layout | Desktop: inline */}
      <div className="flex-1 min-w-0 sm:contents">
        <div className="flex items-center gap-2 sm:contents">
          {/* Task name — primary, always readable */}
          <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">
            {task.title}
          </span>

          {/* Score badge — always visible */}
          <ScoreBadge score={task.displayScore} size="sm" />
        </div>

        {/* Mobile subtitle row: status + deadline */}
        <div className="flex items-center gap-2 mt-0.5 sm:hidden">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              STATUS_PILL_CLASSES[task.status] || STATUS_PILL_CLASSES.TODO
            }`}
          >
            {getStatusLabel(task.status)}
          </span>
          <span
            className={`text-[10px] ${
              isOverdue ? "text-red-500 font-medium" : "text-slate-400"
            }`}
          >
            {task.deadline ? formatDeadline(new Date(task.deadline)) : "No date"}
          </span>
          {task.project && (
            <span
              className="text-[10px] font-medium px-1 py-0.5 rounded truncate max-w-[80px]"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {task.project.name}
            </span>
          )}
        </div>
      </div>

      {/* Desktop-only inline elements */}
      {/* Project name badge */}
      {task.project && (
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline-block"
          style={{
            backgroundColor: `${color}20`,
            color: color,
          }}
        >
          {task.project.name}
        </span>
      )}

      {/* Type label */}
      <Badge className={`${getTypeColor(task.type)} text-[9px] px-1.5 py-0 flex-shrink-0 hidden md:inline-flex`}>
        {getTypeLabel(task.type)}
      </Badge>

      {/* Status pill */}
      <span
        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline-block ${
          STATUS_PILL_CLASSES[task.status] || STATUS_PILL_CLASSES.TODO
        }`}
      >
        {getStatusLabel(task.status)}
      </span>

      {/* Due date / overdue indicator */}
      <span
        className={`text-[11px] flex-shrink-0 min-w-[70px] text-right hidden sm:inline ${
          isOverdue
            ? "text-red-500 font-medium"
            : task.deadline
            ? "text-slate-500"
            : "text-slate-400 italic"
        }`}
      >
        {task.deadline ? formatDeadline(new Date(task.deadline)) : "No date"}
      </span>

      {/* Score badge — desktop (hidden on mobile, shown inline above) */}
      <span className="hidden sm:inline">
        <ScoreBadge score={task.displayScore} size="sm" />
      </span>
    </div>
  );
}
