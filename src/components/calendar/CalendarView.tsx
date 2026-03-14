"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  differenceInCalendarDays,
  getDay,
} from "date-fns";
import type { TaskWithRelations } from "@/types";
import { getTaskColor, getDateProgress, getStatusColor } from "@/lib/utils";
import { ScoreBadge } from "@/components/tasks/ScoreBadge";

type ViewMode = "monthly" | "weekly" | "daily";

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

// Studio work days: Sun(0) - Thu(4)
function isWorkDay(day: Date): boolean {
  const d = getDay(day);
  return d >= 0 && d <= 4;
}

function getTaskColorWithProgress(task: TaskWithRelations): string {
  return getTaskColor(
    task.project?.color ?? null,
    task.category ?? null,
    getDateProgress(
      task.startDate,
      task.deadline,
      task.project?.startDate,
      task.project?.targetFinishDate
    )
  );
}

function getTasksForDay(
  day: Date,
  scheduledTasks: TaskWithRelations[]
): TaskWithRelations[] {
  return scheduledTasks.filter((t) => {
    const start = new Date(t.startDate!);
    const end = new Date(t.deadline!);
    return isWithinInterval(day, {
      start: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
      end: new Date(end.getFullYear(), end.getMonth(), end.getDate()),
    });
  });
}

// ---- Shared Task Pill Component ----
function TaskPill({
  task,
  compact = false,
  canDrag = false,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  task: TaskWithRelations;
  compact?: boolean;
  canDrag?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  const color = getTaskColorWithProgress(task);
  const statusDot = getStatusColor(task.status);

  return (
    <div
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        backgroundColor: `${color}25`,
        borderColor: color,
      }}
      className={`
        w-full text-left border rounded transition-opacity hover:opacity-80
        ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
        ${task.emergency ? "ring-1 ring-red-500" : ""}
        ${compact ? "px-1.5 py-0.5" : "px-2 py-1.5"}
      `}
      title={task.title}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Status dot */}
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
        {/* Task name */}
        <span
          className={`font-medium text-slate-800 truncate flex-1 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {task.title}
        </span>
        {/* Project name (non-compact only) */}
        {!compact && task.project && (
          <span className="text-[9px] text-slate-400 truncate max-w-[80px] flex-shrink-0">
            {task.project.name}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Day Detail Panel (for monthly click) ----
function DayDetailPanel({
  day,
  tasks,
  onTaskClick,
  onClose,
}: {
  day: Date;
  tasks: TaskWithRelations[];
  onTaskClick: (task: TaskWithRelations) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-full md:w-72 flex-shrink-0 border border-slate-200 rounded-lg overflow-hidden bg-white self-start">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {format(day, "EEEE, MMM d")}
          </h3>
          <span className="text-[10px] text-slate-400">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-200 text-slate-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No tasks</p>
        ) : (
          tasks.map((task) => (
            <TaskPill key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}

export function CalendarView({
  tasks,
  onTaskClick,
  onTaskDatesChange,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const dragInfo = useRef<DragInfo | null>(null);
  const isUnscheduledDragRef = useRef(false);

  const scheduledTasks = useMemo(
    () => tasks.filter((t) => t.startDate && t.deadline),
    [tasks]
  );
  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.startDate || !t.deadline),
    [tasks]
  );

  // Navigation handlers
  const goNext = () => {
    if (viewMode === "monthly") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "weekly") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const goPrev = () => {
    if (viewMode === "monthly") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "weekly") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  // Compute days for current view
  const days = useMemo(() => {
    if (viewMode === "daily") {
      return [startOfDay(currentDate)];
    }
    if (viewMode === "weekly") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
    // monthly
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate, viewMode]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const dayTasks = getTasksForDay(day, scheduledTasks);
      if (dayTasks.length > 0) map.set(key, dayTasks);
    }
    return map;
  }, [days, scheduledTasks]);

  // Tasks for the selected day panel (monthly)
  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];
    return getTasksForDay(selectedDay, scheduledTasks);
  }, [selectedDay, scheduledTasks]);

  // Drag handlers
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
      if (dropTarget !== dayKey) setDropTarget(dayKey);
    },
    [dropTarget]
  );

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      setDropTarget(null);
      if (!onTaskDatesChange) return;

      const unscheduledTaskId = e.dataTransfer.getData("application/x-unscheduled-task");
      if (unscheduledTaskId) {
        const endDay = addDays(targetDay, 1);
        onTaskDatesChange(unscheduledTaskId, targetDay.toISOString(), endDay.toISOString());
        isUnscheduledDragRef.current = false;
        return;
      }

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

  // Header label
  const headerLabel = useMemo(() => {
    if (viewMode === "daily") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (viewMode === "weekly") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "d, yyyy")}`;
      }
      return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [currentDate, viewMode]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekDaysMobile = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 min-w-0 border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={goPrev}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{headerLabel}</h2>
              <button
                onClick={goToday}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                Today
              </button>
            </div>

            <button
              onClick={goNext}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(["monthly", "weekly", "daily"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    setSelectedDay(null);
                  }}
                  className={`px-2.5 py-1.5 sm:py-1 text-[10px] font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-[#C8FF00] text-slate-900"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {mode === "monthly" ? "Month" : mode === "weekly" ? "Week" : "Day"}
                </button>
              ))}
            </div>

            {/* Unscheduled toggle */}
            {unscheduledTasks.length > 0 && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`text-[10px] px-2 py-1.5 sm:py-1 rounded-lg transition-colors flex items-center gap-1 ${
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
          </div>
        </div>

        {/* ============ MONTHLY VIEW ============ */}
        {viewMode === "monthly" && (
          <>
            <div className="grid grid-cols-7 border-b border-slate-200">
              {weekDays.map((d, i) => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{weekDaysMobile[i]}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDay.get(key) || [];
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const isDropHere = dropTarget === key;
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const visibleTasks = dayTasks.slice(0, 3);
                const overflow = dayTasks.length - 3;

                return (
                  <div
                    key={key}
                    className={`
                      min-h-[60px] sm:min-h-[100px] border-b border-r border-slate-100 p-1
                      transition-colors duration-100 cursor-pointer
                      ${!inMonth ? "bg-slate-50/50" : ""}
                      ${isDropHere ? "bg-[#C8FF00]/10 ring-2 ring-inset ring-[#C8FF00]/40" : ""}
                      ${isSelected ? "ring-2 ring-inset ring-[#C8FF00]" : ""}
                    `}
                    onDragOver={(e) => handleDragOver(e, key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                    onClick={() => setSelectedDay(day)}
                  >
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
                    </div>
                    <div className="space-y-0.5">
                      {visibleTasks.map((task) => {
                        const canDrag = !!onTaskDatesChange && isSameDay(day, new Date(task.startDate!));
                        return (
                          <TaskPill
                            key={task.id}
                            task={task}
                            compact
                            canDrag={canDrag}
                            onDragStart={(e) => handleDragStart(e, task, day)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onTaskClick(task)}
                          />
                        );
                      })}
                      {overflow > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                          }}
                          className="text-[9px] text-[#65a30d] hover:text-[#4d7c0f] font-medium px-1"
                        >
                          +{overflow} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ============ WEEKLY VIEW ============ */}
        {viewMode === "weekly" && (
          <>
            <div className="grid grid-cols-7 border-b border-slate-200">
              {days.map((day) => {
                const today = isToday(day);
                const workDay = isWorkDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`py-2 text-center border-r border-slate-100 last:border-r-0 ${
                      !workDay ? "bg-slate-50/60" : ""
                    }`}
                  >
                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                      today ? "text-red-500" : workDay ? "text-slate-600" : "text-slate-300"
                    }`}>
                      {format(day, "EEE")}
                    </div>
                    <div className={`text-sm font-medium mt-0.5 ${
                      today ? "text-red-500" : workDay ? "text-slate-800" : "text-slate-300"
                    }`}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDay.get(key) || [];
                const today = isToday(day);
                const workDay = isWorkDay(day);
                const isDropHere = dropTarget === key;

                return (
                  <div
                    key={key}
                    className={`
                      min-h-[200px] sm:min-h-[400px] border-r border-slate-100 last:border-r-0 p-1 sm:p-2
                      transition-colors duration-100
                      ${!workDay ? "bg-slate-50/40" : ""}
                      ${today ? "bg-red-50/20" : ""}
                      ${isDropHere ? "bg-[#C8FF00]/10 ring-2 ring-inset ring-[#C8FF00]/40" : ""}
                    `}
                    onDragOver={(e) => handleDragOver(e, key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className="space-y-1.5">
                      {dayTasks.map((task) => {
                        const canDrag = !!onTaskDatesChange && isSameDay(day, new Date(task.startDate!));
                        return (
                          <TaskPill
                            key={task.id}
                            task={task}
                            canDrag={canDrag}
                            onDragStart={(e) => handleDragStart(e, task, day)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onTaskClick(task)}
                          />
                        );
                      })}
                      {dayTasks.length === 0 && workDay && (
                        <div className="text-[10px] text-slate-300 text-center pt-8">
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ============ DAILY VIEW ============ */}
        {viewMode === "daily" && (() => {
          const day = days[0];
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const today = isToday(day);
          const isDropHere = dropTarget === key;

          return (
            <div
              className={`
                min-h-[300px] sm:min-h-[500px] p-3 sm:p-4
                ${isDropHere ? "bg-[#C8FF00]/10" : ""}
              `}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className="flex items-center gap-3 mb-4">
                {today && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-medium">
                    Today
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                </span>
              </div>

              {dayTasks.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-slate-400">No tasks scheduled</p>
                  {onTaskDatesChange && (
                    <p className="text-[10px] text-slate-300 mt-1">
                      Drag tasks from the sidebar to schedule them
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  {dayTasks.map((task) => {
                    const color = getTaskColorWithProgress(task);
                    const canDrag = !!onTaskDatesChange && isSameDay(day, new Date(task.startDate!));
                    const statusDot = getStatusColor(task.status);

                    return (
                      <div
                        key={task.id}
                        draggable={canDrag}
                        onDragStart={canDrag ? (e) => handleDragStart(e, task, day) : undefined}
                        onDragEnd={canDrag ? handleDragEnd : undefined}
                        onClick={() => onTaskClick(task)}
                        style={{
                          backgroundColor: `${color}15`,
                          borderColor: color,
                        }}
                        className={`
                          border-l-4 rounded-lg px-4 py-3
                          hover:shadow-sm transition-shadow
                          ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                          ${task.emergency ? "ring-1 ring-red-500" : ""}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                              <span className="text-sm font-medium text-slate-800 truncate">
                                {task.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 ml-4">
                              {task.project && (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-[11px] text-slate-500">
                                    {task.project.name}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {task.startDate && task.deadline
                                  ? `${format(new Date(task.startDate), "MMM d")} - ${format(new Date(task.deadline), "MMM d")}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                          <ScoreBadge score={task.displayScore} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 bg-slate-50">
          <span className="text-[10px] text-slate-400">
            Colors = project + phase + timeline position
          </span>
          {onTaskDatesChange && (
            <span className="text-[10px] text-slate-400 ml-auto">
              Drag task to reschedule
            </span>
          )}
        </div>
      </div>

      {/* Day detail panel (monthly click) */}
      {viewMode === "monthly" && selectedDay && (
        <DayDetailPanel
          day={selectedDay}
          tasks={selectedDayTasks}
          onTaskClick={onTaskClick}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Unscheduled sidebar */}
      {unscheduledTasks.length > 0 && sidebarOpen && !(viewMode === "monthly" && selectedDay) && (
        <div className="w-full md:w-56 flex-shrink-0 border border-slate-200 rounded-lg overflow-hidden bg-white self-start">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600">Unscheduled</h3>
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
              const taskColor = getTaskColorWithProgress(task);
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
