"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ScoreBadge } from "@/components/tasks/ScoreBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDeadline } from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface KanbanCardProps {
  task: TaskWithRelations;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function KanbanCard({ task, onClick, selectable, selected, onToggleSelect }: KanbanCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
    },
    [task.id]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const deadlineText = formatDeadline(new Date(task.deadline));
  const isOverdue = deadlineText.includes("overdue") || deadlineText === "Due now";

  return (
    <div
      draggable={!selectable ? "true" : undefined}
      onDragStart={!selectable ? handleDragStart : undefined}
      onDragEnd={!selectable ? handleDragEnd : undefined}
    >
      <motion.div
        layout
        layoutId={`kanban-${task.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={onClick}
        className={`
          relative bg-white rounded-lg border border-slate-200 p-3
          shadow-sm hover:shadow-md transition-shadow duration-150
          select-none
          ${!selectable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
          ${task.emergency ? "ring-2 ring-red-500" : ""}
          ${selected ? "ring-2 ring-[#C8FF00]" : ""}
          ${isDragging ? "opacity-50" : ""}
        `}
      >
        {/* Batch select checkbox */}
        {selectable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(task.id);
            }}
            className={`absolute top-2 right-2 w-4.5 h-4.5 rounded border-2 flex items-center justify-center z-10 transition-colors ${
              selected
                ? "bg-[#C8FF00] border-[#C8FF00]"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
            style={{ width: 18, height: 18 }}
          >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </button>
        )}

        {/* Title */}
        <h4 className="text-sm font-medium text-slate-800 truncate pr-5">{task.title}</h4>

        {/* Project badge */}
        {task.project && (
          <div className="mt-1.5">
            <Badge
              className="border text-[10px]"
              style={{
                borderColor: task.project.color,
                color: task.project.color,
                backgroundColor: `${task.project.color}15`,
              } as React.CSSProperties}
            >
              {task.project.name}
            </Badge>
          </div>
        )}

        {/* Bottom row: owner, deadline, score */}
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Owner avatar + name */}
            <div className="flex items-center gap-1 min-w-0">
              {task.owner.image ? (
                <img
                  src={task.owner.image}
                  alt={task.owner.name}
                  className="w-4 h-4 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-medium text-slate-600">
                    {task.owner.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-[11px] text-slate-500 truncate">
                {task.owner.name.split(" ")[0]}
              </span>
            </div>

            {/* Deadline */}
            <span
              className={`text-[11px] flex-shrink-0 ${
                isOverdue ? "text-red-500 font-medium" : "text-slate-400"
              }`}
            >
              {deadlineText}
            </span>
          </div>

          {/* Score badge */}
          <ScoreBadge score={task.displayScore} size="sm" />
        </div>
      </motion.div>
    </div>
  );
}
