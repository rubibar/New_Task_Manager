"use client";

import { Button } from "../ui/Button";

interface QuickActionsProps {
  onNewTask: () => void;
  onNewProject: () => void;
}

export function QuickActions({ onNewTask, onNewProject }: QuickActionsProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={onNewTask}
          size="sm"
          className="w-full justify-start gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Task
        </Button>
        <Button
          onClick={onNewProject}
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z" />
          </svg>
          New Project
        </Button>
        <a href="/kanban" className="contents">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="15" rx="1" />
            </svg>
            Kanban Board
          </Button>
        </a>
        <a href="/timeline" className="contents">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 6h18M3 12h18M3 18h18" />
              <rect x="5" y="4" width="6" height="4" rx="1" fill="currentColor" opacity="0.3" />
            </svg>
            Timeline
          </Button>
        </a>
      </div>
    </div>
  );
}
