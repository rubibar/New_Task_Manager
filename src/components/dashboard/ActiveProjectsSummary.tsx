"use client";

import { useProjects } from "@/hooks/useProjects";
import type { ProjectWithTasks } from "@/types";

interface ActiveProjectsSummaryProps {
  onProjectClick?: (projectId: string) => void;
}

export function ActiveProjectsSummary({ onProjectClick }: ActiveProjectsSummaryProps) {
  const { projects, isLoading } = useProjects();

  const activeProjects = projects.filter(
    (p) => p.status !== "COMPLETED" && p.status !== "ARCHIVED"
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (activeProjects.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Active Projects</h3>
        <p className="text-sm text-slate-400 text-center py-4">No active projects</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">
          Active Projects ({activeProjects.length})
        </h3>
      </div>

      <div className="divide-y divide-slate-50">
        {activeProjects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            onClick={() => onProjectClick?.(project.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onClick,
}: {
  project: ProjectWithTasks;
  onClick: () => void;
}) {
  const totalTasks = project.tasks?.length || project._count?.tasks || 0;
  const doneTasks = project.tasks?.filter((t) => t.status === "DONE").length || 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const overdueTasks = project.tasks?.filter(
    (t) => new Date(t.deadline) < new Date() && t.status !== "DONE"
  ).length || 0;

  const daysLeft = project.targetFinishDate
    ? Math.ceil(
        (new Date(project.targetFinishDate).getTime() - new Date().getTime()) /
          86400000
      )
    : null;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
    >
      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: project.color || "#C8FF00" }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {project.clientName && (
            <span className="text-[10px] text-slate-400">{project.clientName}</span>
          )}
          <span className="text-[10px] text-slate-400">
            {doneTasks}/{totalTasks} tasks
          </span>
          {overdueTasks > 0 && (
            <span className="text-[10px] text-red-500 font-medium">
              {overdueTasks} overdue
            </span>
          )}
        </div>
      </div>

      {/* Right side: progress + days */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Progress bar */}
        <div className="w-16">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: project.color || "#C8FF00",
              }}
            />
          </div>
          <p className="text-[9px] text-slate-400 text-right mt-0.5">{progress}%</p>
        </div>

        {/* Days left */}
        {daysLeft !== null && (
          <span
            className={`text-[11px] font-medium whitespace-nowrap ${
              daysLeft < 0
                ? "text-red-500"
                : daysLeft <= 7
                ? "text-amber-500"
                : "text-slate-400"
            }`}
          >
            {daysLeft < 0
              ? `${Math.abs(daysLeft)}d over`
              : daysLeft === 0
              ? "Due today"
              : `${daysLeft}d left`}
          </span>
        )}
      </div>
    </div>
  );
}
