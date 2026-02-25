"use client";

import { AnimatePresence } from "framer-motion";
import { TaskCard } from "../tasks/TaskCard";
import type { TaskWithRelations } from "@/types";

interface HeatmapGridProps {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
}

export function HeatmapGrid({ tasks, onTaskClick }: HeatmapGridProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">No tasks to display.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
