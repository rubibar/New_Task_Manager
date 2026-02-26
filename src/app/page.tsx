"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTasks } from "@/hooks/useTasks";
import { useFilters } from "@/hooks/useFilters";
import { Spotlight } from "@/components/dashboard/Spotlight";
import { HeatmapGrid } from "@/components/dashboard/HeatmapGrid";
import { ReviewBar } from "@/components/dashboard/ReviewBar";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { FilterBar } from "@/components/ui/FilterBar";
import { Button } from "@/components/ui/Button";
import type { TaskWithRelations } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { tasks, isLoading } = useTasks();
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, applyFilters } = useFilters();
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);

  const userId = (session as unknown as Record<string, unknown>)?.userId as
    | string
    | undefined;

  // Apply filters then filter active tasks, sort by score
  const activeTasks = applyFilters(tasks)
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => b.displayScore - a.displayScore);

  const topTask = activeTasks[0] || null;
  const restTasks = activeTasks.slice(1);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-[#C8FF00] flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-900 font-bold text-xl">R</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">
            Replica Task Manager
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            Sign in to access your dashboard
          </p>
          <a href="/login">
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-slate-100 p-6 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
          <div className="h-6 bg-slate-100 rounded w-64 mb-4" />
          <div className="h-4 bg-slate-100 rounded w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-100 p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Dashboard</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Task</Button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={updateFilter}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Banners */}
      <StatusBanner />

      {/* Main layout */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 space-y-6">
          <Spotlight
            task={topTask}
            onClick={() => topTask && setSelectedTask(topTask)}
          />
          <HeatmapGrid tasks={restTasks} onTaskClick={setSelectedTask} />
        </div>

        {userId && (
          <div className="hidden lg:block w-72 flex-shrink-0">
            <ReviewBar tasks={tasks} currentUserId={userId} />
          </div>
        )}
      </div>

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
