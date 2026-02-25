"use client";

import { useMemo, useState } from "react";
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
} from "date-fns";
import type { TaskWithRelations } from "@/types";

interface CalendarViewProps {
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
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

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(
    () => eachDayOfInterval({ start: calStart, end: calEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calStart.getTime(), calEnd.getTime()]
  );

  // Build a map: date string -> tasks active on that day
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = tasks.filter((t) => {
        const start = new Date(t.startDate);
        const end = new Date(t.deadline);
        // Task spans this day if the day falls within [startDate, deadline]
        return isWithinInterval(day, {
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
          end: new Date(end.getFullYear(), end.getMonth(), end.getDate()),
        });
      });
      if (dayTasks.length > 0) {
        map.set(key, dayTasks);
      }
    }
    return map;
  }, [days, tasks]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

          return (
            <div
              key={key}
              className={`
                min-h-[100px] border-b border-r border-slate-100 p-1
                ${!inMonth ? "bg-slate-50/50" : ""}
              `}
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

              {/* Task pills (max 3 visible) */}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const isStart = isSameDay(
                    day,
                    new Date(task.startDate)
                  );
                  const isEnd = isSameDay(
                    day,
                    new Date(task.deadline)
                  );
                  const isMiddle = !isStart && !isEnd;

                  return (
                    <button
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={`
                        w-full text-left truncate text-[9px] font-medium
                        px-1 py-0.5 border transition-opacity hover:opacity-80
                        ${TYPE_BG[task.type] || "bg-slate-100 text-slate-700 border-slate-200"}
                        ${isStart && !isEnd ? "rounded-l" : ""}
                        ${isEnd && !isStart ? "rounded-r" : ""}
                        ${isStart && isEnd ? "rounded" : ""}
                        ${isMiddle ? "rounded-none border-x-0" : ""}
                        ${task.emergency ? "ring-1 ring-red-500" : ""}
                      `}
                      title={task.title}
                    >
                      {isStart ? task.title : ""}
                      {isMiddle && (
                        <span className="opacity-0">.</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 bg-slate-50">
        {Object.entries({ CLIENT: "Client", INTERNAL_RD: "R&D", ADMIN: "Admin" }).map(
          ([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${TYPE_DOT[type]}`} />
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
