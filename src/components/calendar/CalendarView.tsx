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

interface CalendarViewProps {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskDatesChange?: (
    taskId: string,
    startDate: string,
    deadline: string
  ) => void;
}

const TYPE_DOT: Record<string, string> = {
  CLIENT: "bg-red-400",
  INTERNAL_RD: "bg-lime-500",
  ADMIN: "bg-violet-400",
};

const TYPE_BG: Record<string, string> = {
  CLIENT: "bg-red-100 text-red-800 border-red-200",
  INTERNAL_RD: "bg-lime-100 text-lime-800 border-lime-200",
  ADMIN: "bg-violet-100 text-violet-800 border-violet-200",
};

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
  const dragInfo = useRef<DragInfo | null>(null);

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
      const dayTasks = tasks.filter((t) => {
        const start = new Date(t.startDate);
        const end = new Date(t.deadline);
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
  }, [days, tasks]);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, task: TaskWithRelations, day: Date) => {
      dragInfo.current = { taskId: task.id, task, originDay: day };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
      // Make the drag image semi-transparent
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

      if (!dragInfo.current || !onTaskDatesChange) return;

      const { task, originDay } = dragInfo.current;
      const daysDelta = differenceInCalendarDays(targetDay, originDay);

      if (daysDelta === 0) return;

      const newStart = addDays(new Date(task.startDate), daysDelta);
      const newEnd = addDays(new Date(task.deadline), daysDelta);

      onTaskDatesChange(task.id, newStart.toISOString(), newEnd.toISOString());
      dragInfo.current = null;
    },
    [onTaskDatesChange]
  );

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
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
                  const isStart = isSameDay(day, new Date(task.startDate));
                  const isEnd = isSameDay(day, new Date(task.deadline));
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
                      className={`
                        w-full text-left truncate text-[9px] font-medium
                        px-1 py-0.5 border transition-opacity hover:opacity-80
                        ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                        ${TYPE_BG[task.type] || "bg-slate-100 text-slate-700 border-slate-200"}
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
        {Object.entries({
          CLIENT: "Client",
          INTERNAL_RD: "R&D",
          ADMIN: "Admin",
        }).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${TYPE_DOT[type]}`} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
        {onTaskDatesChange && (
          <span className="text-[10px] text-slate-400 ml-auto">
            Drag task from start day to reschedule
          </span>
        )}
      </div>
    </div>
  );
}
