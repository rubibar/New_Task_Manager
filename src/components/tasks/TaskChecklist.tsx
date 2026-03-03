"use client";

import { useState, useRef, FormEvent } from "react";
import {
  useChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/hooks/useChecklist";

interface TaskChecklistProps {
  taskId: string;
}

export function TaskChecklist({ taskId }: TaskChecklistProps) {
  const { items, total, completed, isLoading } = useChecklist(taskId);
  const [newItemText, setNewItemText] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await addChecklistItem(taskId, text);
      setNewItemText("");
      inputRef.current?.focus();
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (itemId: string, currentCompleted: boolean) => {
    await toggleChecklistItem(taskId, itemId, !currentCompleted);
  };

  const handleDelete = async (itemId: string) => {
    await deleteChecklistItem(taskId, itemId);
  };

  if (isLoading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Checklist
        </h4>
        <div className="h-8 bg-slate-50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Checklist
        </h4>
        {total > 0 && (
          <span className="text-xs text-slate-500">
            {completed}/{total}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? "#22c55e" : "#C8FF00",
            }}
          />
        </div>
      )}

      {/* Items list */}
      <div className="space-y-0.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 py-1.5 px-1 rounded hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => handleToggle(item.id, item.completed)}
              className="w-4 h-4 rounded border-slate-300 text-[#C8FF00] focus:ring-[#C8FF00] cursor-pointer flex-shrink-0"
            />
            <span
              className={`text-sm flex-1 ${
                item.completed
                  ? "line-through text-slate-400"
                  : "text-slate-700"
              }`}
            >
              {item.text}
            </span>
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-0.5 flex-shrink-0"
              title="Remove item"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <form onSubmit={handleAdd} className="mt-2">
        <input
          ref={inputRef}
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="+ Add item"
          disabled={adding}
          className="w-full px-2 py-1.5 text-sm rounded border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#C8FF00] placeholder:text-slate-400 disabled:opacity-50"
        />
      </form>
    </div>
  );
}
