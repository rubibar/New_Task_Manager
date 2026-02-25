"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { ScoreBadge } from "../tasks/ScoreBadge";
import { changeTaskStatus } from "@/hooks/useTasks";
import type { TaskWithRelations } from "@/types";

interface ReviewBarProps {
  tasks: TaskWithRelations[];
  currentUserId: string;
}

export function ReviewBar({ tasks, currentUserId }: ReviewBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const reviewTasks = tasks.filter((t) => t.status === "IN_REVIEW");
  const myReviews = reviewTasks.filter((t) => t.reviewerId === currentUserId);
  const otherReviews = reviewTasks.filter(
    (t) => t.reviewerId !== currentUserId
  );

  if (reviewTasks.length === 0) return null;

  const handleAction = async (taskId: string, action: string) => {
    setLoading(taskId);
    try {
      await changeTaskStatus(taskId, action);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-amber-500"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <h3 className="text-sm font-semibold text-amber-800">
          Quick Review ({reviewTasks.length})
        </h3>
      </div>

      <div className="space-y-2">
        {/* My reviews first */}
        {myReviews.map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-lg border border-amber-200 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {task.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  from {task.owner.name}
                </p>
              </div>
              <ScoreBadge score={task.displayScore} size="sm" />
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => handleAction(task.id, "APPROVED")}
                loading={loading === task.id}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleAction(task.id, "REQUEST_CHANGES")}
                loading={loading === task.id}
              >
                Changes
              </Button>
            </div>
          </div>
        ))}

        {/* Others */}
        {otherReviews.map((task) => (
          <div
            key={task.id}
            className="bg-white/50 rounded-lg border border-slate-200 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 truncate">{task.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {task.owner.name} → {task.reviewer?.name}
                </p>
              </div>
              <ScoreBadge score={task.displayScore} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
