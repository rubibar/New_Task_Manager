"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval,
  addMonths,
  subMonths,
  addDays,
  differenceInCalendarDays,
} from "date-fns";
import type { TaskWithRelations } from "@/types";
import { getTaskColor } from "@/lib/utils";
import { ScoreBadge } from "@/components/tasks/ScoreBadge";

interface CalendarViewProps {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskDatesChange?: (
    taskId: string,
    startDate: string,
    deadline: string
  ) => void;
}

interface DragInfo {
  taskId: string;
  task: TaskWithRelations;
  originDay: Date;
}

export function CalendarView({
  tasks,
  onTaskClick,
  onTaskDatesChange,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const dragInfo = useRef<DragInfo | null>(null);
  // Track whether the current drag is from the unscheduled sidebar (for visual cues)
  const isUnscheduledDragRef = useRef(false);

  // Split tasks into scheduled and unscheduled
  const scheduledTasks = useMemo(
    () => tasks.filter((t) => t.startDate && t.deadline),
    [tasks]
  );
  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.startDate || !t.deadline),
    [tasks]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(
    () => eachDayOfInterval({ start: calStart, end: calEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calStart.getTime(), calEnd.getTime()]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = scheduledTasks.filter((t) => {
        const start = new Date(t.startDate!);
        const end = new Date(t.deadline!);
        return isWithinInterval(day, {
          start: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          ),
          end: new Date(end.getFullYear(), end.getMonth(), end.getDate()),
        });
      });
      if (dayTasks.length > 0) {
        map.set(key, dayTasks);
      }
    }
    return map;
  }, [days, scheduledTasks]);

  // Drag handlers for scheduled tasks (move existing)
  const handleDragStart = useCallback(
    (e: React.DragEvent, task: TaskWithRelations, day: Date) => {
      dragInfo.current = { taskId: task.id, task, originDay: day };
      isUnscheduledDragRef.current = false;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    dragInfo.current = null;
    setDropTarget(null);
    isUnscheduledDragRef.current = false;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, dayKey: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTarget !== dayKey) {
        setDropTarget(dayKey);
      }
    },
    [dropTarget]
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      setDropTarget(null);

      if (!onTaskDatesChange) return;

      // Check for unscheduled task drop
      const unscheduledTaskId = e.dataTransfer.getData("application/x-unscheduled-task");
      if (unscheduledTaskId) {
        const endDay = addDays(targetDay, 1);
        onTaskDatesChange(unscheduledTaskId, targetDay.toISOString(), endDay.toISOString());
        isUnscheduledDragRef.current = false;
        return;
      }

      // Existing scheduled task move
      if (!dragInfo.current) return;

      const { task, originDay } = dragInfo.current;
      const daysDelta = differenceInCalendarDays(targetDay, originDay);

      if (daysDelta === 0) return;

      const newStart = addDays(new Date(task.startDate!), daysDelta);
      const newEnd = addDays(new Date(task.deadline!), daysDelta);

      onTaskDatesChange(task.id, newStart.toISOString(), newEnd.toISOString());
      dragInfo.current = null;
    },
    [onTaskDatesChange]
  );

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex gap-4">
      {/* Main calendar */}
      <div className="flex-1 min-w-0 border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
            >
              Today
            </button>
          </div>
          <div className="flex items-center gap-2">
            {unscheduledTasks.length > 0 && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  sidebarOpen
                    ? "bg-[#C8FF00] text-slate-900"
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                {unscheduledTasks.length}
              </button>
            )}
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {weekDays.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isDropHere = dropTarget === key;

            return (
              <div
                key={key}
                className={`
                  min-h-[100px] border-b border-r border-slate-100 p-1
                  transition-colors duration-100
                  ${!inMonth ? "bg-slate-50/50" : ""}
                  ${isDropHere ? "bg-[#C8FF00]/10 ring-2 ring-inset ring-[#C8FF00]/40" : ""}
                `}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`
                      text-xs w-6 h-6 flex items-center justify-center rounded-full
                      ${today ? "bg-red-500 text-white font-bold" : ""}
                      ${!today && inMonth ? "text-slate-700" : ""}
                      ${!today && !inMonth ? "text-slate-300" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>
                  {dayTasks.length > 3 && (
                    <span className="text-[9px] text-slate-400">
                      +{dayTasks.length - 3}
                    </span>
                  )}
                </div>

                {/* Task pills */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const isStart = isSameDay(day, new Date(task.startDate!));
                    const isEnd = isSameDay(day, new Date(task.deadline!));
                    const isMiddle = !isStart && !isEnd;
                    const canDrag = !!onTaskDatesChange && isStart;

                    return (
                      <div
                        key={task.id}
                        draggable={canDrag}
                        onDragStart={
                          canDrag
                            ? (e) => handleDragStart(e, task, day)
                            : undefined
                        }
                        onDragEnd={canDrag ? handleDragEnd : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task);
                        }}
                        style={{
                          backgroundColor: `${getTaskColor(task.project?.color ?? null, task.category ?? null)}30`,
                          borderColor: getTaskColor(task.project?.color ?? null, task.category ?? null),
                          color: "#1e293b",
                        }}
                        className={`
                          w-full text-left truncate text-[9px] font-medium
                          px-1 py-0.5 border transition-opacity hover:opacity-80
                          ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                          ${isStart && !isEnd ? "rounded-l" : ""}
                          ${isEnd && !isStart ? "rounded-r" : ""}
                          ${isStart && isEnd ? "rounded" : ""}
                          ${isMiddle ? "rounded-none border-x-0" : ""}
                          ${task.emergency ? "ring-1 ring-red-500" : ""}
                        `}
                        title={`${task.title}${canDrag ? " (drag to reschedule)" : ""}`}
                      >
                        {isStart ? task.title : ""}
                        {isMiddle && <span className="opacity-0">.</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 bg-slate-50">
          <span className="text-[10px] text-slate-400">
            Colors = project + phase
          </span>
          {onTaskDatesChange && (
            <span className="text-[10px] text-slate-400 ml-auto">
              Drag task from start day to reschedule
            </span>
          )}
        </div>
      </div>

      {/* Unscheduled sidebar */}
      {unscheduledTasks.length > 0 && sidebarOpen && (
        <div className="w-56 flex-shrink-0 border border-slate-200 rounded-lg overflow-hidden bg-white self-start">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600">
                Unscheduled
              </h3>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
                {unscheduledTasks.length}
              </span>
            </div>
            {onTaskDatesChange && (
              <p className="text-[10px] text-slate-400 mt-1">
                Drag onto a day to schedule
              </p>
            )}
          </div>

          <div className="p-2 space-y-1.5 max-h-[500px] overflow-y-auto">
            {unscheduledTasks.map((task) => {
              const taskColor = getTaskColor(task.project?.color ?? null, task.category ?? null);
              return (
                <div
                  key={task.id}
                  draggable={!!onTaskDatesChange}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-unscheduled-task", task.id);
                    e.dataTransfer.effectAllowed = "move";
                    isUnscheduledDragRef.current = true;
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "0.5";
                    }
                  }}
                  onDragEnd={(e) => {
                    if (e.currentTarget instanceof HTMLElement) {
                      e.currentTarget.style.opacity = "1";
                    }
                    isUnscheduledDragRef.current = false;
                  }}
                  onClick={() => onTaskClick(task)}
                  className={`
                    p-2 rounded-lg border bg-white hover:shadow-sm transition-shadow
                    ${onTaskDatesChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                    ${task.emergency ? "ring-1 ring-red-500" : ""}
                  `}
                  style={{ borderColor: taskColor }}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-[11px] font-medium text-slate-700 truncate flex-1">
                      {task.title}
                    </span>
                    <ScoreBadge score={task.displayScore} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: taskColor }}
                    />
                    {task.owner.image ? (
                      <img
                        src={task.owner.image}
                        alt={task.owner.name}
                        className="w-3.5 h-3.5 rounded-full"
                      />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-300 flex items-center justify-center">
                        <span className="text-[7px] font-medium text-slate-600">
                          {task.owner.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 truncate">
                      {task.owner.name.split(" ")[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
