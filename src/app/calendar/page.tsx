"use client";

import { useState, useCallback } from "react";
import { useTasks, updateTask } from "@/hooks/useTasks";
import { useFilters } from "@/hooks/useFilters";
import { CalendarView } from "@/components/calendar/CalendarView";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { FilterBar } from "@/components/ui/FilterBar";
import { Button } from "@/components/ui/Button";
import type { TaskWithRelations } from "@/types";

export default function CalendarPage() {
  const { tasks, isLoading } = useTasks();
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, applyFilters } = useFilters();
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const activeTasks = applyFilters(tasks).filter((t) => t.status !== "DONE");

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
        <div className="h-[600px] bg-slate-50 rounded-lg border border-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Calendar</h1>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          + New Task
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFilterChange={updateFilter}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      <CalendarView
        tasks={activeTasks}
        onTaskClick={setSelectedTask}
        onTaskDatesChange={handleDatesChange}
      />

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
