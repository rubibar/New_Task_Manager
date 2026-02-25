"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTasks } from "@/hooks/useTasks";
import { CalendarView } from "@/components/calendar/CalendarView";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { Button } from "@/components/ui/Button";
import type { TaskWithRelations } from "@/types";

export default function CalendarPage() {
  const { data: session } = useSession();
  const { tasks, isLoading } = useTasks();
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  const userId = (session as unknown as Record<string, unknown>)?.userId as string | undefined;

  const filteredTasks = filter === "mine" && userId
    ? tasks.filter((t) => t.ownerId === userId)
    : tasks;

  const activeTasks = filteredTasks.filter((t) => t.status !== "DONE");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="h-[600px] bg-slate-50 rounded-lg border border-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filter === "all"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setFilter("mine")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filter === "mine"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              My Tasks
            </button>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            + New Task
          </Button>
        </div>
      </div>

      <CalendarView tasks={activeTasks} onTaskClick={setSelectedTask} />

      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
