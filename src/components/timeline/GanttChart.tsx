"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  differenceInDays,
  addDays,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns";
import type { TaskWithRelations } from "@/types";

interface GanttChartProps {
  tasks: TaskWithRelations[];
  groupBy: "project" | "owner";
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskDatesChange?: (
    taskId: string,
    startDate: string,
    deadline: string
  ) => void;
}

const TYPE_COLORS: Record<string, string> = {
  CLIENT: "bg-red-200 border-red-300",
  INTERNAL_RD: "bg-lime-200 border-lime-300",
  ADMIN: "bg-violet-200 border-violet-300",
};

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;

type DragMode = "move" | "resize-start" | "resize-end";

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  daysDelta: number;
}

export function GanttChart({
  tasks,
  groupBy,
  onTaskClick,
  onTaskDatesChange,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(4);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const now = new Date();
  const viewStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
  const viewEnd = endOfWeek(addWeeks(now, viewWeeks - 1), { weekStartsOn: 0 });

  const days = useMemo(
    () => eachDayOfInterval({ start: viewStart, end: viewEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewStart.getTime(), viewEnd.getTime()]
  );

  const weeks = useMemo(
    () =>
      eachWeekOfInterval(
        { start: viewStart, end: viewEnd },
        { weekStartsOn: 0 }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewStart.getTime(), viewEnd.getTime()]
  );

  const totalWidth = days.length * DAY_WIDTH;

  // Group tasks
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; tasks: TaskWithRelations[] }
    >();

    for (const task of tasks) {
      let key: string;
      let label: string;

      if (groupBy === "project") {
        key = task.projectId || "no-project";
        label = task.project?.name || "No Project";
      } else {
        key = task.ownerId;
        label = task.owner.name;
      }

      if (!map.has(key)) map.set(key, { label, tasks: [] });
      map.get(key)!.tasks.push(task);
    }

    return Array.from(map.values());
  }, [tasks, groupBy]);

  const getBarPosition = useCallback(
    (start: Date, end: Date) => {
      const startOffset = differenceInDays(start, viewStart);
      const duration = Math.max(1, differenceInDays(end, start));
      return {
        left: startOffset * DAY_WIDTH,
        width: duration * DAY_WIDTH,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewStart.getTime()]
  );

  // Get adjusted dates for a task while dragging
  const getDraggedDates = useCallback(
    (task: TaskWithRelations) => {
      if (!drag || drag.taskId !== task.id) return null;
      const { mode, originalStart, originalEnd, daysDelta } = drag;

      let newStart = originalStart;
      let newEnd = originalEnd;

      if (mode === "move") {
        newStart = addDays(originalStart, daysDelta);
        newEnd = addDays(originalEnd, daysDelta);
      } else if (mode === "resize-start") {
        newStart = addDays(originalStart, daysDelta);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      } else if (mode === "resize-end") {
        newEnd = addDays(originalEnd, daysDelta);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      }

      return { start: newStart, end: newEnd };
    },
    [drag]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, task: TaskWithRelations, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();

      const state: DragState = {
        taskId: task.id,
        mode,
        startX: e.clientX,
        originalStart: new Date(task.startDate),
        originalEnd: new Date(task.deadline),
        daysDelta: 0,
      };

      dragRef.current = state;
      setDrag(state);
    },
    []
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const daysDelta = Math.round(deltaX / DAY_WIDTH);

    if (daysDelta !== dragRef.current.daysDelta) {
      const newState = { ...dragRef.current, daysDelta };
      dragRef.current = newState;
      setDrag(newState);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;

    const { taskId, mode, originalStart, originalEnd, daysDelta } =
      dragRef.current;

    if (daysDelta !== 0 && onTaskDatesChange) {
      let newStart = originalStart;
      let newEnd = originalEnd;

      if (mode === "move") {
        newStart = addDays(originalStart, daysDelta);
        newEnd = addDays(originalEnd, daysDelta);
      } else if (mode === "resize-start") {
        newStart = addDays(originalStart, daysDelta);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      } else if (mode === "resize-end") {
        newEnd = addDays(originalEnd, daysDelta);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      }

      onTaskDatesChange(
        taskId,
        newStart.toISOString(),
        newEnd.toISOString()
      );
    }

    dragRef.current = null;
    setDrag(null);
  }, [onTaskDatesChange]);

  // Global mouse handlers for drag
  useEffect(() => {
    if (drag) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = drag.mode === "move" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [drag, handleMouseMove, handleMouseUp]);

  const todayOffset = differenceInDays(now, viewStart) * DAY_WIDTH;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-xs text-slate-500">View:</span>
        {[2, 4, 8].map((w) => (
          <button
            key={w}
            onClick={() => setViewWeeks(w)}
            className={`text-xs px-2 py-1 rounded ${
              viewWeeks === w
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            {w}w
          </button>
        ))}
        {onTaskDatesChange && (
          <span className="text-[10px] text-slate-400 ml-auto">
            Drag bars to reschedule
          </span>
        )}
      </div>

      <div ref={containerRef} className="overflow-x-auto">
        <div style={{ width: totalWidth, minWidth: "100%" }} className="relative">
          {/* Week headers */}
          <div
            className="flex border-b border-slate-200 sticky top-0 bg-white z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            {weeks.map((week) => {
              const weekDays = eachDayOfInterval({
                start: week,
                end: endOfWeek(week, { weekStartsOn: 0 }),
              }).filter((d) => d >= viewStart && d <= viewEnd);

              return (
                <div
                  key={week.toISOString()}
                  style={{ width: weekDays.length * DAY_WIDTH }}
                  className="border-r border-slate-100"
                >
                  <div className="text-[10px] text-slate-500 font-medium px-2 py-1 border-b border-slate-100">
                    {format(week, "MMM d")}
                  </div>
                  <div className="flex">
                    {weekDays.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className={`text-[9px] text-center py-1 ${
                          isToday(day)
                            ? "text-red-500 font-bold"
                            : "text-slate-400"
                        }`}
                      >
                        {format(day, "EEE")}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Swimlanes */}
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <div className="flex items-center px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-600">
                  {group.label}
                </span>
                <span className="text-[10px] text-slate-400 ml-2">
                  ({group.tasks.length})
                </span>
              </div>

              {/* Task bars */}
              {group.tasks.map((task) => {
                const dragged = getDraggedDates(task);
                const taskStart = dragged
                  ? dragged.start
                  : new Date(task.startDate);
                const taskEnd = dragged
                  ? dragged.end
                  : new Date(task.deadline);
                const pos = getBarPosition(taskStart, taskEnd);
                const isDragging =
                  drag?.taskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-slate-50"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((day) => (
                        <div
                          key={day.toISOString()}
                          style={{ width: DAY_WIDTH }}
                          className={`border-r border-slate-50 ${
                            isToday(day) ? "bg-red-50/30" : ""
                          }`}
                        />
                      ))}
                    </div>

                    {/* Bar */}
                    <div
                      className={`
                        absolute top-1 rounded border flex items-center
                        transition-shadow select-none
                        ${TYPE_COLORS[task.type] || "bg-slate-200 border-slate-300"}
                        ${task.emergency ? "ring-1 ring-red-500" : ""}
                        ${isDragging ? "shadow-lg opacity-90 z-30" : "hover:shadow-md z-10"}
                      `}
                      style={{
                        left: pos.left,
                        width: Math.max(pos.width, DAY_WIDTH),
                        height: ROW_HEIGHT - 8,
                      }}
                      title={`${task.title} (${format(taskStart, "MMM d")} - ${format(taskEnd, "MMM d")})`}
                    >
                      {/* Left resize handle */}
                      {onTaskDatesChange && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l z-20"
                          onMouseDown={(e) =>
                            handleMouseDown(e, task, "resize-start")
                          }
                        />
                      )}

                      {/* Main bar body — draggable to move */}
                      <div
                        className={`flex-1 px-2 truncate ${
                          onTaskDatesChange
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer"
                        }`}
                        onMouseDown={(e) => {
                          if (onTaskDatesChange) {
                            handleMouseDown(e, task, "move");
                          }
                        }}
                        onClick={(e) => {
                          if (!drag) {
                            e.stopPropagation();
                            onTaskClick(task);
                          }
                        }}
                      >
                        <span className="text-[10px] font-medium text-slate-700 truncate">
                          {task.title}
                        </span>
                      </div>

                      {/* Right resize handle */}
                      {onTaskDatesChange && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-r z-20"
                          onMouseDown={(e) =>
                            handleMouseDown(e, task, "resize-end")
                          }
                        />
                      )}
                    </div>

                    {/* Date tooltip while dragging */}
                    {isDragging && dragged && (
                      <div
                        className="absolute -top-6 bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap z-40 pointer-events-none"
                        style={{
                          left: pos.left,
                        }}
                      >
                        {format(dragged.start, "MMM d")} -{" "}
                        {format(dragged.end, "MMM d")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Today marker */}
          <div
            className="absolute top-0 w-0.5 bg-red-400 z-20 pointer-events-none"
            style={{
              left: todayOffset,
              top: 0,
              height: "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
}
