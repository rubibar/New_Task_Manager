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
}

export function KanbanCard({ task, onClick }: KanbanCardProps) {
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
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        layout
        layoutId={`kanban-${task.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={onClick}
        className={`
          bg-white rounded-lg border border-slate-200 p-3 cursor-grab
          shadow-sm hover:shadow-md transition-shadow duration-150
          active:cursor-grabbing select-none
          ${task.emergency ? "ring-2 ring-red-500" : ""}
          ${isDragging ? "opacity-50" : ""}
        `}
      >
        {/* Title */}
        <h4 className="text-sm font-medium text-slate-800 truncate">{task.title}</h4>

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
