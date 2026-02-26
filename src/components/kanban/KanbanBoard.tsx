"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { KanbanCard } from "./KanbanCard";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import type { TaskWithRelations } from "@/types";

interface KanbanBoardProps {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  selectable?: boolean;
  isSelected?: (id: string) => boolean;
  onToggleSelect?: (id: string) => void;
}

const COLUMNS = [
  { status: "TODO", bg: "bg-slate-50", borderHighlight: "border-slate-300" },
  { status: "IN_PROGRESS", bg: "bg-blue-50/50", borderHighlight: "border-blue-300" },
  { status: "IN_REVIEW", bg: "bg-amber-50/50", borderHighlight: "border-amber-300" },
  { status: "DONE", bg: "bg-green-50/50", borderHighlight: "border-green-300" },
] as const;

const WIP_LIMIT = 5;

export function KanbanBoard({ tasks, onTaskClick, onStatusChange, selectable, isSelected, onToggleSelect }: KanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getColumnTasks = useCallback(
    (status: string) => {
      return tasks
        .filter((t) => t.status === status)
        .sort((a, b) => b.displayScore - a.displayScore);
    },
    [tasks]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if we're leaving the column itself, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, status: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      // Only trigger change if the status is actually different
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== status) {
        onStatusChange(taskId, status);
      }
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4 min-h-[calc(100vh-200px)]">
      {COLUMNS.map((column) => {
        const columnTasks = getColumnTasks(column.status);
        const isOver = dragOverColumn === column.status;
        const isOverWip = columnTasks.length > WIP_LIMIT;

        return (
          <div
            key={column.status}
            onDragOver={!selectable ? (e) => handleDragOver(e, column.status) : undefined}
            onDragLeave={!selectable ? handleDragLeave : undefined}
            onDrop={!selectable ? (e) => handleDrop(e, column.status) : undefined}
            className={`
              flex flex-col rounded-xl border transition-all duration-150
              ${column.bg}
              ${
                isOver
                  ? `border-dashed border-2 ${column.borderHighlight} bg-opacity-80`
                  : "border-slate-200"
              }
            `}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${getStatusColor(column.status)}`}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {getStatusLabel(column.status)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isOverWip && (
                  <span
                    className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded"
                    title={`Over WIP limit of ${WIP_LIMIT}`}
                  >
                    WIP
                  </span>
                )}
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                    isOverWip
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards area */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    selectable={selectable}
                    selected={isSelected?.(task.id)}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </AnimatePresence>

              {columnTasks.length === 0 && (
                <div
                  className={`
                    flex items-center justify-center h-20 rounded-lg
                    border-2 border-dashed border-slate-200/60
                    text-xs text-slate-400
                    ${isOver ? "bg-white/50" : ""}
                  `}
                >
                  {isOver ? "Drop here" : "No tasks"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
