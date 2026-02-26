"use client";

import useSWR from "swr";
import type { TaskWithRelations, UserWithCapacity } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface TeamWorkloadProps {
  tasks: TaskWithRelations[];
}

export function TeamWorkload({ tasks }: TeamWorkloadProps) {
  const { data: users } = useSWR<UserWithCapacity[]>("/api/users", fetcher);

  if (!users || users.length === 0) return null;

  const activeTasks = tasks.filter((t) => t.status !== "DONE");

  const memberStats = users.map((user) => {
    const userTasks = activeTasks.filter((t) => t.ownerId === user.id);
    const overdue = userTasks.filter(
      (t) => new Date(t.deadline) < new Date()
    ).length;
    const inProgress = userTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const inReview = userTasks.filter((t) => t.status === "IN_REVIEW").length;
    const todo = userTasks.filter((t) => t.status === "TODO").length;

    return {
      user,
      total: userTasks.length,
      overdue,
      inProgress,
      inReview,
      todo,
    };
  });

  const maxTasks = Math.max(...memberStats.map((m) => m.total), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Team Workload</h3>
      </div>

      <div className="p-4 space-y-4">
        {memberStats.map(({ user, total, overdue, inProgress, inReview, todo }) => (
          <div key={user.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-[9px] font-medium text-slate-600">
                      {user.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-sm text-slate-700">{user.name}</span>
                {user.atCapacity && (
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                    At Capacity
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                {overdue > 0 && (
                  <span className="text-red-500 font-medium">{overdue} overdue</span>
                )}
                <span className="text-slate-400">{total} tasks</span>
              </div>
            </div>

            {/* Stacked bar */}
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
              {inProgress > 0 && (
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(inProgress / maxTasks) * 100}%` }}
                  title={`${inProgress} in progress`}
                />
              )}
              {inReview > 0 && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${(inReview / maxTasks) * 100}%` }}
                  title={`${inReview} in review`}
                />
              )}
              {todo > 0 && (
                <div
                  className="h-full bg-slate-300"
                  style={{ width: `${(todo / maxTasks) * 100}%` }}
                  title={`${todo} to do`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-1">
              {inProgress > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-[9px] text-slate-400">{inProgress} active</span>
                </div>
              )}
              {inReview > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[9px] text-slate-400">{inReview} review</span>
                </div>
              )}
              {todo > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[9px] text-slate-400">{todo} todo</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
