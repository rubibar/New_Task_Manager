"use client";

import { motion } from "framer-motion";
import { ScoreBadge } from "./ScoreBadge";
import { Badge } from "../ui/Badge";
import {
  getStatusColor,
  getStatusLabel,
  getTypeColor,
  getTypeLabel,
  getHeatBgClass,
  formatDeadline,
} from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface TaskCardProps {
  task: TaskWithRelations;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const heatClass = getHeatBgClass(task.displayScore);

  return (
    <motion.div
      layout
      layoutId={task.id}
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`
        relative rounded-lg border p-4 cursor-pointer
        hover:shadow-md transition-shadow duration-150
        ${heatClass}
        ${task.emergency ? "ring-2 ring-red-500 animate-pulse" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">
            {task.title}
          </h3>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.project && (
              <Badge
                className="border"
                style={{
                  borderColor: task.project.color,
                  color: task.project.color,
                  backgroundColor: `${task.project.color}15`,
                } as React.CSSProperties}
              >
                {task.project.name}
              </Badge>
            )}
            <Badge className={getTypeColor(task.type)}>
              {getTypeLabel(task.type)}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-3">
            {/* Owner avatar */}
            <div className="flex items-center gap-1.5">
              {task.owner.image ? (
                <img
                  src={task.owner.image}
                  alt={task.owner.name}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center">
                  <span className="text-[9px] font-medium text-slate-600">
                    {task.owner.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-xs text-slate-500">{task.owner.name}</span>
            </div>

            {/* Deadline */}
            <span className="text-xs text-slate-500">
              {formatDeadline(new Date(task.deadline))}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <ScoreBadge score={task.displayScore} size="sm" />
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${getStatusColor(
                task.status
              )}`}
            />
            <span className="text-[10px] text-slate-500">
              {getStatusLabel(task.status)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
