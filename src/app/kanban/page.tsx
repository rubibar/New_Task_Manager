"use client";

import { useState, useCallback } from "react";
import { useTasks, changeTaskStatus } from "@/hooks/useTasks";
import { useFilters } from "@/hooks/useFilters";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { FilterBar } from "@/components/ui/FilterBar";
import type { TaskWithRelations } from "@/types";

export default function KanbanPage() {
  const { tasks, isLoading } = useTasks();
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
  } = useFilters();
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);

  const filteredTasks = applyFilters(tasks);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
    try {
      await changeTaskStatus(taskId, newStatus);
    } catch (err) {
      console.error("Failed to change task status:", err);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[500px] bg-slate-50 rounded-xl border border-slate-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Kanban Board</h1>
        <span className="text-xs text-slate-500">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={updateFilter}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Board */}
      {filteredTasks.length === 0 && !hasActiveFilters ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">No tasks to display.</p>
        </div>
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={setSelectedTask}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Task detail drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
