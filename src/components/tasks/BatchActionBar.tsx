"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/Button";
import { useProjects } from "@/hooks/useProjects";
import type { UserWithCapacity } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface BatchActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  allTaskIds: string[];
  onSelectAll: (ids: string[]) => void;
}

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "URGENT_IMPORTANT", label: "Urgent" },
  { value: "IMPORTANT_NOT_URGENT", label: "High" },
  { value: "URGENT_NOT_IMPORTANT", label: "Medium" },
  { value: "NEITHER", label: "Low" },
];

async function executeBatch(
  taskIds: string[],
  action: string,
  value?: string
) {
  const res = await fetch("/api/tasks/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds, action, value }),
  });
  if (!res.ok) throw new Error("Batch action failed");
  await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}

export function BatchActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  allTaskIds,
  onSelectAll,
}: BatchActionBarProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { projects } = useProjects();
  const { data: users } = useSWR<UserWithCapacity[]>("/api/users", fetcher);

  if (selectedCount === 0) return null;

  const handleAction = async (action: string, value?: string) => {
    setLoading(true);
    try {
      await executeBatch(selectedIds, action, value);
      onClearSelection();
    } catch (err) {
      console.error("Batch action failed:", err);
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-4xl">
      {/* Count + Select all */}
      <div className="flex items-center gap-2 border-r border-slate-700 pr-3">
        <span className="text-sm font-semibold">{selectedCount} selected</span>
        {selectedCount < allTaskIds.length && (
          <button
            type="button"
            onClick={() => onSelectAll(allTaskIds)}
            className="text-xs text-[#C8FF00] hover:underline"
          >
            Select all ({allTaskIds.length})
          </button>
        )}
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-slate-400 hover:text-white"
        >
          Clear
        </button>
      </div>

      {/* Status dropdown */}
      <div className="relative group">
        <button
          type="button"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Status
        </button>
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleAction("changeStatus", opt.value)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority dropdown */}
      <div className="relative group">
        <button
          type="button"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Priority
        </button>
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleAction("changePriority", opt.value)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assign dropdown */}
      <div className="relative group">
        <button
          type="button"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Assign
        </button>
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          {(users || []).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleAction("changeOwner", u.id)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {/* Move to project */}
      <div className="relative group">
        <button
          type="button"
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Project
        </button>
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[160px] max-h-48 overflow-y-auto">
          <button
            type="button"
            onClick={() => handleAction("changeProject", "")}
            className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50"
          >
            No Project
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleAction("changeProject", p.id)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Delete */}
      {!showConfirmDelete ? (
        <Button
          size="sm"
          variant="danger"
          disabled={loading}
          onClick={() => setShowConfirmDelete(true)}
        >
          Delete
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="danger"
            loading={loading}
            onClick={() => handleAction("delete")}
          >
            Confirm Delete
          </Button>
          <button
            type="button"
            onClick={() => setShowConfirmDelete(false)}
            className="text-xs text-slate-400 hover:text-white px-2"
          >
            Cancel
          </button>
        </div>
      )}

      {loading && (
        <div className="animate-spin w-4 h-4 border-2 border-slate-600 border-t-[#C8FF00] rounded-full" />
      )}
    </div>
  );
}
