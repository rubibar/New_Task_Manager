"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "../ui/Badge";
import { ScoreBadge } from "../tasks/ScoreBadge";
import {
  getStatusColor,
  getStatusLabel,
  getTypeColor,
  getTypeLabel,
  formatDeadline,
} from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface MyTasksProps {
  tasks: TaskWithRelations[];
  currentUserId: string;
  onTaskClick: (task: TaskWithRelations) => void;
}

export function MyTasks({ tasks, currentUserId, onTaskClick }: MyTasksProps) {
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming">("all");

  const myTasks = tasks
    .filter((t) => t.ownerId === currentUserId && t.status !== "DONE")
    .sort((a, b) => b.displayScore - a.displayScore);

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const threeDaysOut = new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0];

  const filteredTasks = myTasks.filter((t) => {
    const deadlineDate = new Date(t.deadline).toISOString().split("T")[0];
    switch (filter) {
      case "overdue":
        return new Date(t.deadline) < now;
      case "today":
        return deadlineDate === today;
      case "upcoming":
        return deadlineDate > today && deadlineDate <= threeDaysOut;
      default:
        return true;
    }
  });

  const overdueCount = myTasks.filter((t) => new Date(t.deadline) < now).length;
  const todayCount = myTasks.filter(
    (t) => new Date(t.deadline).toISOString().split("T")[0] === today
  ).length;

  const filterOptions = [
    { key: "all" as const, label: "All", count: myTasks.length },
    { key: "overdue" as const, label: "Overdue", count: overdueCount },
    { key: "today" as const, label: "Today", count: todayCount },
    { key: "upcoming" as const, label: "Soon", count: null },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">My Tasks</h3>
        <div className="flex items-center gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                filter === opt.key
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {opt.label}
              {opt.count !== null && opt.count > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({opt.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-400">
              {filter === "all" ? "No tasks assigned to you" : `No ${filter} tasks`}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={() => onTaskClick(task)}
                className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(task.status)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.project && (
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: task.project.color }}
                      >
                        {task.project.name}
                      </span>
                    )}
                    <Badge className={`${getTypeColor(task.type)} text-[9px] px-1.5 py-0`}>
                      {getTypeLabel(task.type)}
                    </Badge>
                    <span className="text-[10px] text-slate-400">
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[11px] ${
                      new Date(task.deadline) < now
                        ? "text-red-500 font-medium"
                        : "text-slate-500"
                    }`}
                  >
                    {formatDeadline(new Date(task.deadline))}
                  </span>
                  <ScoreBadge score={task.displayScore} size="sm" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
