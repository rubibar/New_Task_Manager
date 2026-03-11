"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { ProjectInsightPanel } from "./ProjectInsightPanel";
import { HealthScoreBreakdown } from "@/components/health/HealthScoreBreakdown";
import { TaskRow } from "@/components/dashboard/TaskRow";
import { useProjectHealthScore, recalculateProjectHealth } from "@/hooks/useHealthScores";
import { useDeliverables, resequenceDeliverable } from "@/hooks/useDeliverables";
import { useTasks } from "@/hooks/useTasks";
import type { ProjectWithTasks, TaskWithRelations } from "@/types";

interface ProjectDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  project: ProjectWithTasks | null;
  onEdit: () => void;
  onTaskClick?: (task: TaskWithRelations) => void;
}

type Tab = "overview" | "tasks" | "deliverables" | "insights";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
};

const STATUS_ORDER: Record<string, number> = {
  IN_REVIEW: 0,
  IN_PROGRESS: 1,
  TODO: 2,
  DONE: 3,
};

const STATUS_GROUP_LABELS: Record<string, string> = {
  IN_REVIEW: "In Review",
  IN_PROGRESS: "In Progress",
  TODO: "To Do",
  DONE: "Done",
};

export function ProjectDetailDrawer({
  open,
  onClose,
  project,
  onEdit,
  onTaskClick,
}: ProjectDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [doneExpanded, setDoneExpanded] = useState(false);
  const { score: healthScore, isLoading: healthLoading, refresh: refreshHealth } = useProjectHealthScore(project?.id ?? null);
  const { deliverables } = useDeliverables(project?.id ?? null);
  const { tasks: projectTasks, isLoading: tasksLoading } = useTasks(
    project?.id ? { projectId: project.id } : undefined
  );
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    if (!project) return;
    setRecalculating(true);
    try {
      await recalculateProjectHealth(project.id);
      refreshHealth();
    } catch {
      // ignore
    } finally {
      setRecalculating(false);
    }
  };

  if (!project) return null;

  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Group tasks by status for the tasks tab
  const sortedTasks = [...projectTasks].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return b.displayScore - a.displayScore;
  });

  const taskGroups = ["IN_REVIEW", "IN_PROGRESS", "TODO", "DONE"].map((status) => ({
    status,
    label: STATUS_GROUP_LABELS[status],
    tasks: sortedTasks.filter((t) => t.status === status),
  })).filter((g) => g.tasks.length > 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: `Tasks (${totalTasks})` },
    { key: "deliverables", label: `Deliverables (${deliverables.length})` },
    { key: "insights", label: "AI Insights" },
  ];

  return (
    <Drawer open={open} onClose={onClose} title={project.name}>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Status + Progress */}
            <div className="flex items-center justify-between">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  project.status === "IN_PROGRESS" || project.status === "ACTIVE"
                    ? "bg-green-100 text-green-700"
                    : project.status === "COMPLETED"
                    ? "bg-blue-100 text-blue-700"
                    : project.status === "ON_HOLD"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {STATUS_LABELS[project.status] || project.status}
              </span>
              <span className="text-xs text-slate-500">
                {doneTasks}/{totalTasks} tasks done
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, backgroundColor: project.color }}
                />
              </div>
              <div className="text-right text-xs text-slate-400 mt-1">
                {progress}% complete
              </div>
            </div>

            {/* Health Score */}
            <HealthScoreBreakdown
              score={healthScore}
              loading={healthLoading}
              onRecalculate={handleRecalculate}
              recalculating={recalculating}
            />

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              {project.clientName && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Client
                  </span>
                  <p className="text-sm text-slate-800">{project.clientName}</p>
                </div>
              )}
              {project.projectType && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Type
                  </span>
                  <p className="text-sm text-slate-800">
                    {(project.projectType as { name: string }).name}
                  </p>
                </div>
              )}
              {project.startDate && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Start
                  </span>
                  <p className="text-sm text-slate-800">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.targetFinishDate && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Target Finish
                  </span>
                  <p className="text-sm text-slate-800">
                    {new Date(project.targetFinishDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.budget != null && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Budget
                  </span>
                  <p className="text-sm text-slate-800">
                    ${project.budget.toLocaleString()}
                  </p>
                </div>
              )}
              {project.hourlyRate != null && (
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    Hourly Rate
                  </span>
                  <p className="text-sm text-slate-800">
                    ${project.hourlyRate}/hr
                  </p>
                </div>
              )}
            </div>

            {project.description && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] uppercase text-slate-400 font-medium">
                  Description
                </span>
                <p className="text-xs text-slate-600 mt-1">
                  {project.description}
                </p>
              </div>
            )}

            {/* Task breakdown */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] uppercase text-slate-400 font-medium mb-2 block">
                Tasks
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "To Do", count: project.tasks.filter((t) => t.status === "TODO").length, color: "text-slate-600" },
                  { label: "In Progress", count: project.tasks.filter((t) => t.status === "IN_PROGRESS").length, color: "text-blue-600" },
                  { label: "In Review", count: project.tasks.filter((t) => t.status === "IN_REVIEW").length, color: "text-amber-600" },
                  { label: "Done", count: doneTasks, color: "text-green-600" },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded p-2">
                    <div className={`text-lg font-bold ${item.color}`}>
                      {item.count}
                    </div>
                    <div className="text-[10px] text-slate-400">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button size="sm" variant="secondary" onClick={onEdit}>
                Edit Project
              </Button>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="space-y-3">
            {tasksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : taskGroups.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-xs text-slate-400">No tasks in this project</p>
              </div>
            ) : (
              taskGroups.map((group) => {
                const isDone = group.status === "DONE";
                const isExpanded = isDone ? doneExpanded : true;

                return (
                  <div key={group.status}>
                    <div className="flex items-center gap-2 mb-1">
                      {isDone ? (
                        <button
                          onClick={() => setDoneExpanded(!doneExpanded)}
                          className="flex items-center gap-1.5 group"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`text-slate-400 transition-transform ${doneExpanded ? "rotate-90" : ""}`}
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
                            {group.label}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-slate-600">
                          {group.label}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        ({group.tasks.length})
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                        {group.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onClick={() => onTaskClick?.(task)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Deliverables Tab */}
        {activeTab === "deliverables" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
                <p className="text-xs text-slate-400">
                  No deliverables for this project
                </p>
              </div>
            ) : (
              deliverables.map((del) => {
                const tasks = del.tasks || [];
                const tasksDone = tasks.filter((t) => t.status === "DONE").length;
                const taskProgress = tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0;

                return (
                  <div
                    key={del.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">
                          {del.name}
                        </h4>
                        {del.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {del.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          DELIVERABLE_STATUS_COLORS[del.status] ||
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {del.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                      <span>
                        Due: {new Date(del.dueDate).toLocaleDateString()}
                      </span>
                      {tasks.length > 0 && (
                        <span>{tasksDone}/{tasks.length} tasks done</span>
                      )}
                    </div>
                    {tasks.length > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${taskProgress}%`,
                              backgroundColor: taskProgress === 100 ? "#22c55e" : project.color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {tasks.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => resequenceDeliverable(del.id).catch(() => {})}
                        className="mt-2 text-[10px] text-[#65a30d] hover:text-[#4d7c0f] font-medium"
                      >
                        Re-sequence tasks
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* AI Insights Tab */}
        {activeTab === "insights" && (
          <ProjectInsightPanel projectId={project.id} />
        )}
      </div>
    </Drawer>
  );
}
