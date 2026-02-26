"use client";

import type { ProjectWithTasks } from "@/types";

interface ProjectCardProps {
  project: ProjectWithTasks;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-shadow bg-white"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h3 className="text-sm font-semibold text-slate-800">
              {project.name}
            </h3>
          </div>
          {project.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            project.status === "IN_PROGRESS" || project.status === "ACTIVE"
              ? "bg-green-100 text-green-700"
              : project.status === "COMPLETED"
              ? "bg-blue-100 text-blue-700"
              : project.status === "ON_HOLD"
              ? "bg-yellow-100 text-yellow-700"
              : project.status === "NOT_STARTED"
              ? "bg-slate-100 text-slate-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {project.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>
            {doneTasks}/{totalTasks} tasks
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: project.color,
            }}
          />
        </div>
      </div>
    </div>
  );
}
