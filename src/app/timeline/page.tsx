"use client";

import { useState, useCallback } from "react";
import { useTasks, updateTask } from "@/hooks/useTasks";
import { GanttChart } from "@/components/timeline/GanttChart";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import type { TaskWithRelations } from "@/types";

export default function TimelinePage() {
  const { tasks, isLoading } = useTasks();
  const [groupBy, setGroupBy] = useState<"project" | "owner">("project");
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(
    null
  );

  const activeTasks = tasks.filter((t) => t.status !== "DONE");

  const handleDatesChange = useCallback(
    async (taskId: string, startDate: string, deadline: string) => {
      try {
        await updateTask(taskId, { startDate, deadline });
      } catch (err) {
        console.error("Failed to update task dates:", err);
      }
    },
    []
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="h-[400px] bg-slate-50 rounded-lg border border-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Timeline</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Group by:</span>
          <button
            onClick={() => setGroupBy("project")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              groupBy === "project"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Project
          </button>
          <button
            onClick={() => setGroupBy("owner")}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              groupBy === "owner"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Owner
          </button>
        </div>
      </div>

      {activeTasks.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">
            No active tasks to display on the timeline.
          </p>
        </div>
      ) : (
        <GanttChart
          tasks={activeTasks}
          groupBy={groupBy}
          onTaskClick={setSelectedTask}
          onTaskDatesChange={handleDatesChange}
        />
      )}

      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
