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
import type { Milestone } from "@prisma/client";
import { getTaskColor } from "@/lib/utils";
import { ScoreBadge } from "@/components/tasks/ScoreBadge";
import {
  DependencyArrows,
  type BarPosition,
  type DependencyLink,
} from "./DependencyArrows";
import { MilestoneMarkers } from "./MilestoneMarkers";

interface GanttChartProps {
  tasks: TaskWithRelations[];
  groupBy: "project" | "owner";
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskDatesChange?: (
    taskId: string,
    startDate: string,
    deadline: string
  ) => void;
  milestones?: Milestone[];
}

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 56;
const GROUP_HEADER_HEIGHT = 30;

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
  milestones,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(4);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [unscheduledOpen, setUnscheduledOpen] = useState(true);
  const [dropTargetDay, setDropTargetDay] = useState<string | null>(null);
  const [affectedTaskIds, setAffectedTaskIds] = useState<Set<string>>(
    new Set()
  );

  // Split tasks into scheduled (have both dates) and unscheduled
  const scheduledTasks = useMemo(
    () => tasks.filter((t) => t.startDate && t.deadline),
    [tasks]
  );
  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.startDate || !t.deadline),
    [tasks]
  );

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

  // Group scheduled tasks only
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; tasks: TaskWithRelations[] }
    >();

    for (const task of scheduledTasks) {
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
  }, [scheduledTasks, groupBy]);

  // Compute bar positions for dependency arrows
  const barPositions = useMemo(() => {
    const positions: BarPosition[] = [];
    let yOffset = HEADER_HEIGHT;

    for (const group of groups) {
      yOffset += GROUP_HEADER_HEIGHT; // group header
      for (const task of group.tasks) {
        const start = new Date(task.startDate!);
        const end = new Date(task.deadline!);
        const startOffset = differenceInDays(start, viewStart);
        const duration = Math.max(1, differenceInDays(end, start));
        const left = startOffset * DAY_WIDTH;
        const width = duration * DAY_WIDTH;

        positions.push({
          taskId: task.id,
          left,
          width: Math.max(width, DAY_WIDTH),
          top: yOffset + 4, // top-1 padding
          height: ROW_HEIGHT - 8,
        });
        yOffset += ROW_HEIGHT;
      }
    }

    return positions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, viewStart.getTime()]);

  // Total chart height for SVG overlay
  const totalChartHeight = useMemo(() => {
    let h = HEADER_HEIGHT;
    for (const group of groups) {
      h += GROUP_HEADER_HEIGHT + group.tasks.length * ROW_HEIGHT;
    }
    return h;
  }, [groups]);

  // Build dependency links from task data
  const dependencyLinks = useMemo(() => {
    const links: DependencyLink[] = [];
    const scheduledIds = new Set(scheduledTasks.map((t) => t.id));

    for (const task of scheduledTasks) {
      const deps = (task as TaskWithRelations & { dependencies?: { dependsOnId: string }[] }).dependencies;
      if (deps) {
        for (const dep of deps) {
          if (scheduledIds.has(dep.dependsOnId)) {
            links.push({
              fromTaskId: dep.dependsOnId,
              toTaskId: task.id,
            });
          }
        }
      }
    }

    return links;
  }, [scheduledTasks]);

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

      // Block drag on locked tasks
      if ((task as TaskWithRelations & { manualOverride?: boolean }).manualOverride) return;

      const state: DragState = {
        taskId: task.id,
        mode,
        startX: e.clientX,
        originalStart: new Date(task.startDate!),
        originalEnd: new Date(task.deadline!),
        daysDelta: 0,
      };

      dragRef.current = state;
      setDrag(state);

      // Fetch cascade preview
      fetch(`/api/tasks/${task.id}/cascade-preview`)
        .then((r) => r.json())
        .then((data) => {
          if (data.affectedTaskIds?.length > 0) {
            setAffectedTaskIds(new Set(data.affectedTaskIds));
          }
        })
        .catch(() => {});
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
    setAffectedTaskIds(new Set());
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

  // HTML5 drag handlers for unscheduled chips dropped onto the grid
  const handleChipDragOver = useCallback(
    (e: React.DragEvent, dayKey: string) => {
      if (!e.dataTransfer.types.includes("application/x-unscheduled-task")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropTargetDay !== dayKey) setDropTargetDay(dayKey);
    },
    [dropTargetDay]
  );

  const handleChipDragLeave = useCallback(() => {
    setDropTargetDay(null);
  }, []);

  const handleChipDrop = useCallback(
    (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      setDropTargetDay(null);
      const taskId = e.dataTransfer.getData("application/x-unscheduled-task");
      if (!taskId || !onTaskDatesChange) return;
      const endDay = addDays(targetDay, 1);
      onTaskDatesChange(taskId, targetDay.toISOString(), endDay.toISOString());
    },
    [onTaskDatesChange]
  );

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
              <div
                className="flex items-center px-3 bg-slate-50 border-b border-slate-200"
                style={{ height: GROUP_HEADER_HEIGHT }}
              >
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
                  : new Date(task.startDate!);
                const taskEnd = dragged
                  ? dragged.end
                  : new Date(task.deadline!);
                const pos = getBarPosition(taskStart, taskEnd);
                const isDragging =
                  drag?.taskId === task.id;
                const isLocked = (task as TaskWithRelations & { manualOverride?: boolean }).manualOverride;
                const isAffected = affectedTaskIds.has(task.id) && drag;

                return (
                  <div
                    key={task.id}
                    className="relative border-b border-slate-50"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Grid lines + drop targets */}
                    <div className="absolute inset-0 flex">
                      {days.map((day) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        return (
                          <div
                            key={day.toISOString()}
                            style={{ width: DAY_WIDTH }}
                            className={`border-r border-slate-50 ${
                              isToday(day) ? "bg-red-50/30" : ""
                            } ${dropTargetDay === dayKey ? "bg-[#C8FF00]/10" : ""}`}
                            onDragOver={(e) => handleChipDragOver(e, dayKey)}
                            onDragLeave={handleChipDragLeave}
                            onDrop={(e) => handleChipDrop(e, day)}
                          />
                        );
                      })}
                    </div>

                    {/* Bar */}
                    <div
                      className={`
                        absolute top-1 rounded border flex items-center
                        transition-shadow select-none
                        ${task.emergency ? "ring-1 ring-red-500" : ""}
                        ${isDragging ? "shadow-lg opacity-90 z-30" : "hover:shadow-md z-10"}
                        ${isAffected ? "ring-2 ring-amber-400 ring-offset-1" : ""}
                        ${isLocked ? "opacity-80" : ""}
                      `}
                      style={{
                        left: pos.left,
                        width: Math.max(pos.width, DAY_WIDTH),
                        height: ROW_HEIGHT - 8,
                        backgroundColor: getTaskColor(task.project?.color ?? null, task.category ?? null),
                        borderColor: getTaskColor(task.project?.color ?? null, task.category ?? null),
                      }}
                      title={`${task.title} (${format(taskStart, "MMM d")} - ${format(taskEnd, "MMM d")})${isLocked ? " [Locked]" : ""}`}
                    >
                      {/* Left resize handle */}
                      {onTaskDatesChange && !isLocked && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 rounded-l z-20"
                          onMouseDown={(e) =>
                            handleMouseDown(e, task, "resize-start")
                          }
                        />
                      )}

                      {/* Main bar body — draggable to move */}
                      <div
                        className={`flex-1 px-2 truncate flex items-center gap-1 ${
                          onTaskDatesChange && !isLocked
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer"
                        }`}
                        onMouseDown={(e) => {
                          if (onTaskDatesChange && !isLocked) {
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
                        {/* Lock icon */}
                        {isLocked && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="text-slate-500 flex-shrink-0"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        )}
                        <span className="text-[10px] font-medium text-slate-700 truncate">
                          {task.title}
                        </span>
                      </div>

                      {/* Right resize handle */}
                      {onTaskDatesChange && !isLocked && (
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
                        {affectedTaskIds.size > 0 && (
                          <span className="text-amber-300 ml-1">
                            ({affectedTaskIds.size} will shift)
                          </span>
                        )}
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

          {/* Dependency arrows overlay */}
          {dependencyLinks.length > 0 && (
            <DependencyArrows
              bars={barPositions}
              links={dependencyLinks}
              highlightedTaskIds={drag ? affectedTaskIds : undefined}
              svgWidth={totalWidth}
              svgHeight={totalChartHeight}
            />
          )}

          {/* Milestone markers */}
          {milestones && milestones.length > 0 && (
            <MilestoneMarkers
              milestones={milestones}
              viewStart={viewStart}
              dayWidth={DAY_WIDTH}
              chartHeight={totalChartHeight}
              totalWidth={totalWidth}
            />
          )}
        </div>
      </div>

      {/* Unscheduled tasks tray */}
      {unscheduledTasks.length > 0 && (
        <div className="border-t border-slate-200">
          <button
            onClick={() => setUnscheduledOpen(!unscheduledOpen)}
            className="flex items-center gap-2 w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-slate-400 transition-transform ${unscheduledOpen ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="text-xs font-semibold text-slate-600">
              Unscheduled
            </span>
            <span className="text-[10px] text-slate-400">
              ({unscheduledTasks.length})
            </span>
            {onTaskDatesChange && (
              <span className="text-[10px] text-slate-400 ml-auto">
                Drag onto timeline to schedule
              </span>
            )}
          </button>

          {unscheduledOpen && (
            <div className="px-4 py-3 flex flex-wrap gap-2 bg-white">
              {unscheduledTasks.map((task) => {
                const taskColor = getTaskColor(task.project?.color ?? null, task.category ?? null);
                return (
                  <div
                    key={task.id}
                    draggable={!!onTaskDatesChange}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-unscheduled-task", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "0.5";
                      }
                    }}
                    onDragEnd={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
                    onClick={() => onTaskClick(task)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg border
                      bg-white hover:shadow-sm transition-shadow
                      ${onTaskDatesChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
                      ${task.emergency ? "ring-1 ring-red-500" : ""}
                    `}
                    style={{ borderColor: taskColor }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: taskColor }}
                    />
                    <span className="text-[11px] font-medium text-slate-700 truncate max-w-[160px]">
                      {task.title}
                    </span>
                    {task.owner.image ? (
                      <img
                        src={task.owner.image}
                        alt={task.owner.name}
                        className="w-4 h-4 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-[7px] font-medium text-slate-600">
                          {task.owner.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <ScoreBadge score={task.displayScore} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
