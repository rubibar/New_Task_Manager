"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { useFilters } from "@/hooks/useFilters";
import { useBatchSelection } from "@/hooks/useBatchSelection";
import { TodaysFocus } from "@/components/dashboard/TodaysFocus";
import { ActiveProjectsSummary } from "@/components/dashboard/ActiveProjectsSummary";
import { TeamWorkload } from "@/components/dashboard/TeamWorkload";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ReviewBar } from "@/components/dashboard/ReviewBar";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { BatchActionBar } from "@/components/tasks/BatchActionBar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Button } from "@/components/ui/Button";
import { ProjectWizard } from "@/components/projects/wizard/ProjectWizard";
import { TaskRow } from "@/components/dashboard/TaskRow";
import type { TaskWithRelations } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { tasks, isLoading } = useTasks();
  const { filters, updateFilter, clearFilters, hasActiveFilters, activeFilterCount, applyFilters } = useFilters();
  const batch = useBatchSelection();
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [view, setView] = useState<"overview" | "tasks">("overview");
  const [teamExpanded, setTeamExpanded] = useState(true);

  const userId = (session as unknown as Record<string, unknown>)?.userId as
    | string
    | undefined;
  const userName = session?.user?.name || "there";

  // Apply filters then filter active tasks, sort by score
  const activeTasks = applyFilters(tasks)
    .filter((t) => t.status !== "DONE")
    .sort((a, b) => b.displayScore - a.displayScore);

  const myTasks = activeTasks.filter((t) => t.ownerId === userId);
  const teamTasks = activeTasks.filter((t) => t.ownerId !== userId);

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
        <div className="rounded-xl border border-slate-100 p-6 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
          <div className="h-6 bg-slate-100 rounded w-64 mb-4" />
          <div className="h-4 bg-slate-100 rounded w-48" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-lg animate-pulse" />
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
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("overview")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === "overview"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setView("tasks")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                view === "tasks"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Tasks
            </button>
          </div>
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              if (batchMode) batch.clearSelection();
            }}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              batchMode
                ? "bg-[#C8FF00] text-slate-900"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {batchMode ? "Exit Select" : "Select"}
          </button>
          <Button onClick={() => setCreateOpen(true)}>+ New Task</Button>
        </div>
      </div>

      {/* Banners */}
      <StatusBanner />

      {view === "overview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Focus AI Briefing */}
            <TodaysFocus userName={userName} tasks={activeTasks} />

            {/* My Tasks — slim rows */}
            <TaskSection
              title="My Tasks"
              count={myTasks.length}
              tasks={myTasks}
              onTaskClick={setSelectedTask}
              batchMode={batchMode}
              isSelected={batch.isSelected}
              onToggleSelect={batch.toggle}
            />

            {/* Team Tasks — collapsible slim rows */}
            <TaskSection
              title="Team Tasks"
              count={teamTasks.length}
              tasks={teamTasks}
              onTaskClick={setSelectedTask}
              collapsible
              expanded={teamExpanded}
              onToggleExpand={() => setTeamExpanded(!teamExpanded)}
              batchMode={batchMode}
              isSelected={batch.isSelected}
              onToggleSelect={batch.toggle}
            />
          </div>

          {/* Right column: 1/3 width */}
          <div className="space-y-6">
            <QuickActions
              onNewTask={() => setCreateOpen(true)}
              onNewProject={() => setProjectWizardOpen(true)}
            />
            {userId && (
              <ReviewBar tasks={tasks} currentUserId={userId} />
            )}
            <ActiveProjectsSummary
              onProjectClick={() => router.push("/projects")}
            />
            <TeamWorkload tasks={tasks} />
          </div>
        </div>
      ) : (
        <>
          {/* All Tasks view */}
          <FilterBar
            filters={filters}
            onFilterChange={updateFilter}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />

          <div className="flex gap-6">
            <div className="flex-1 min-w-0 space-y-6">
              {/* My Tasks */}
              <TaskSection
                title="My Tasks"
                count={myTasks.length}
                tasks={myTasks}
                onTaskClick={setSelectedTask}
                batchMode={batchMode}
                isSelected={batch.isSelected}
                onToggleSelect={batch.toggle}
              />

              {/* Team Tasks */}
              <TaskSection
                title="Team Tasks"
                count={teamTasks.length}
                tasks={teamTasks}
                onTaskClick={setSelectedTask}
                collapsible
                expanded={teamExpanded}
                onToggleExpand={() => setTeamExpanded(!teamExpanded)}
                batchMode={batchMode}
                isSelected={batch.isSelected}
                onToggleSelect={batch.toggle}
              />
            </div>

            {userId && (
              <div className="hidden lg:block w-72 flex-shrink-0">
                <ReviewBar tasks={tasks} currentUserId={userId} />
              </div>
            )}
          </div>
        </>
      )}

      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ProjectWizard
        open={projectWizardOpen}
        onClose={() => setProjectWizardOpen(false)}
      />

      <BatchActionBar
        selectedCount={batch.count}
        selectedIds={batch.selectedIds}
        onClearSelection={() => {
          batch.clearSelection();
          setBatchMode(false);
        }}
        allTaskIds={activeTasks.map((t) => t.id)}
        onSelectAll={batch.selectAll}
      />
    </div>
  );
}

// ---- Task Section Component ----
function TaskSection({
  title,
  count,
  tasks,
  onTaskClick,
  collapsible = false,
  expanded = true,
  onToggleExpand,
  batchMode = false,
  isSelected,
  onToggleSelect,
}: {
  title: string;
  count: number;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  collapsible?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  batchMode?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
}) {
  if (count === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {collapsible ? (
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 group"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-500 group-hover:text-slate-700">
              {title}
            </h2>
          </button>
        ) : (
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        )}
        <span className="text-xs text-slate-400">({count})</span>
        {collapsible && (
          <div className="flex-1 h-px bg-slate-200" />
        )}
      </div>

      {(!collapsible || expanded) && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              selectable={batchMode}
              selected={isSelected?.(task.id) ?? false}
              onToggleSelect={() => onToggleSelect?.(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
