"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useActiveTimer,
  startTimer,
  stopTimer,
} from "@/hooks/useTimeEntries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds into HH:MM:SS. */
function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskTimerProps {
  taskId: string;
  taskTitle?: string;
  /** Minimal mode for embedding in cards. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskTimer({
  taskId,
  taskTitle,
  compact = false,
}: TaskTimerProps) {
  const { activeEntry, isRunning } = useActiveTimer();
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Is THIS task's timer running?
  const isThisTaskRunning = isRunning && activeEntry?.taskId === taskId;
  // Is ANOTHER task's timer running?
  const isOtherTaskRunning = isRunning && activeEntry?.taskId !== taskId;

  // ------- Elapsed time ticker -------
  useEffect(() => {
    if (isThisTaskRunning && activeEntry?.startTime) {
      // Compute initial elapsed immediately
      const start = new Date(activeEntry.startTime).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));

      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isThisTaskRunning, activeEntry?.startTime]);

  // ------- Actions -------
  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      // If another task is running, stop it first then start this one
      if (isOtherTaskRunning) {
        await stopTimer();
      }
      await startTimer(taskId);
    } catch (err) {
      console.error("Timer start failed:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, isOtherTaskRunning]);

  const handleStop = useCallback(async () => {
    setLoading(true);
    try {
      await stopTimer();
    } catch (err) {
      console.error("Timer stop failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ------- Compact mode -------
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        {isThisTaskRunning ? (
          <>
            <span className="font-mono text-xs text-slate-700 tabular-nums">
              {formatElapsed(elapsed)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStop();
              }}
              disabled={loading}
              className="
                w-6 h-6 rounded-full flex items-center justify-center
                bg-[#C8FF00] text-slate-900 hover:bg-[#A3D600]
                transition-colors disabled:opacity-50
              "
              title="Stop timer"
            >
              {/* Stop icon (square) */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect x="1" y="1" width="8" height="8" rx="1" />
              </svg>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            disabled={loading}
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              transition-colors disabled:opacity-50
              ${
                isOtherTaskRunning
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }
            `}
            title={
              isOtherTaskRunning
                ? "Switch timer to this task"
                : "Start timer"
            }
          >
            {isOtherTaskRunning ? (
              /* Swap icon */
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            ) : (
              /* Play icon */
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <polygon points="2,0 10,5 2,10" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }

  // ------- Full mode -------
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white">
      {isThisTaskRunning ? (
        <>
          {/* Pulsing green dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8FF00] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8FF00]" />
          </span>

          <div className="flex-1 min-w-0">
            {taskTitle && (
              <p className="text-xs text-slate-500 truncate">{taskTitle}</p>
            )}
            <p className="font-mono text-sm font-medium text-slate-800 tabular-nums">
              {formatElapsed(elapsed)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleStop}
            disabled={loading}
            className="
              px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[#C8FF00] text-slate-900 hover:bg-[#A3D600]
              transition-colors active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Stop
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            {taskTitle && (
              <p className="text-xs text-slate-500 truncate">{taskTitle}</p>
            )}
            <p className="text-xs text-slate-400">No timer running</p>
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={loading}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-medium
              transition-colors active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isOtherTaskRunning
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }
            `}
          >
            {isOtherTaskRunning ? "Switch" : "Start"}
          </button>
        </>
      )}
    </div>
  );
}
