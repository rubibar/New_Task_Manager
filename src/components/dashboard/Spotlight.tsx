"use client";

import { motion } from "framer-motion";
import { ScoreBadge } from "../tasks/ScoreBadge";
import { Badge } from "../ui/Badge";
import { getTypeColor, getTypeLabel, formatDeadline } from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface SpotlightProps {
  task: TaskWithRelations | null;
  onClick: () => void;
}

export function Spotlight({ task, onClick }: SpotlightProps) {
  if (!task) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm">
          No active tasks. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      onClick={onClick}
      className="relative rounded-xl border-2 border-[#C8FF00] bg-gradient-to-br from-[#C8FF00]/5 to-transparent p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-xl bg-[#C8FF00]/5 blur-xl -z-10" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[#A3D600] font-semibold">
              Top Priority
            </span>
            {task.emergency && (
              <Badge className="bg-red-100 text-red-700 text-[10px]">
                EMERGENCY
              </Badge>
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-800">{task.title}</h2>

          {task.project && (
            <span
              className="text-xs font-medium mt-1 inline-block"
              style={{ color: task.project.color }}
            >
              {task.project.name}
            </span>
          )}

          <div className="flex items-center gap-4 mt-4">
            {/* Owner */}
            <div className="flex items-center gap-2">
              {task.owner.image ? (
                <img
                  src={task.owner.image}
                  alt={task.owner.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-slate-600">
                    {task.owner.name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-sm text-slate-600">{task.owner.name}</span>
            </div>

            {/* Deadline */}
            <span className="text-sm text-slate-500">
              {formatDeadline(new Date(task.deadline))}
            </span>

            {/* Type */}
            <Badge className={getTypeColor(task.type)}>
              {getTypeLabel(task.type)}
            </Badge>
          </div>
        </div>

        <ScoreBadge score={task.displayScore} size="lg" />
      </div>
    </motion.div>
  );
}
