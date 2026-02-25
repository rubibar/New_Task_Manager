"use client";

import { useMemo, useState, useRef } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  differenceInDays,
  isToday,
  addWeeks,
  subWeeks,
} from "date-fns";
import type { TaskWithRelations } from "@/types";

interface GanttChartProps {
  tasks: TaskWithRelations[];
  groupBy: "project" | "owner";
  onTaskClick: (task: TaskWithRelations) => void;
}

const TYPE_COLORS: Record<string, string> = {
  CLIENT: "bg-red-200 border-red-300",
  INTERNAL_RD: "bg-lime-200 border-lime-300",
  ADMIN: "bg-violet-200 border-violet-300",
};

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;

export function GanttChart({ tasks, groupBy, onTaskClick }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(4);

  const now = new Date();
  const viewStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
  const viewEnd = endOfWeek(addWeeks(now, viewWeeks - 1), { weekStartsOn: 0 });

  const days = useMemo(
    () => eachDayOfInterval({ start: viewStart, end: viewEnd }),
    [viewStart, viewEnd]
  );

  const weeks = useMemo(
    () =>
      eachWeekOfInterval(
        { start: viewStart, end: viewEnd },
        { weekStartsOn: 0 }
      ),
    [viewStart, viewEnd]
  );

  const totalWidth = days.length * DAY_WIDTH;

  // Group tasks
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; tasks: TaskWithRelations[] }>();

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

  const getBarPosition = (start: Date, end: Date) => {
    const startOffset = differenceInDays(start, viewStart);
    const duration = Math.max(1, differenceInDays(end, start));
    return {
      left: startOffset * DAY_WIDTH,
      width: duration * DAY_WIDTH,
    };
  };

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
      </div>

      <div ref={containerRef} className="overflow-x-auto">
        <div style={{ width: totalWidth, minWidth: "100%" }}>
          {/* Week headers */}
          <div
            className="flex border-b border-slate-200 sticky top-0 bg-white z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            {weeks.map((week) => {
              const weekDays = eachDayOfInterval({
                start: week,
                end: endOfWeek(week, { weekStartsOn: 0 }),
              }).filter(
                (d) => d >= viewStart && d <= viewEnd
              );

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
                const pos = getBarPosition(
                  new Date(task.startDate),
                  new Date(task.deadline)
                );

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-slate-50"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
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
                      onClick={() => onTaskClick(task)}
                      className={`
                        absolute top-1 cursor-pointer rounded border
                        flex items-center px-2 truncate
                        hover:opacity-80 transition-opacity
                        ${TYPE_COLORS[task.type] || "bg-slate-200 border-slate-300"}
                        ${task.emergency ? "ring-1 ring-red-500" : ""}
                      `}
                      style={{
                        left: pos.left,
                        width: Math.max(pos.width, DAY_WIDTH),
                        height: ROW_HEIGHT - 8,
                      }}
                      title={`${task.title} (${format(new Date(task.startDate), "MMM d")} - ${format(new Date(task.deadline), "MMM d")})`}
                    >
                      <span className="text-[10px] font-medium text-slate-700 truncate">
                        {task.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Today marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20 pointer-events-none"
            style={{
              left: todayOffset,
              top: 0,
              height: "100%",
              position: "absolute",
            }}
          />
        </div>
      </div>
    </div>
  );
}
