"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveTimer, stopTimer } from "@/hooks/useTimeEntries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Persistent floating bar rendered at the top of the viewport while a timer
 * is running. Self-contained — reads state from useActiveTimer().
 */
export function GlobalTimer() {
  const { activeEntry, isRunning } = useActiveTimer();
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second while a timer is active
  useEffect(() => {
    if (isRunning && activeEntry?.startTime) {
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
  }, [isRunning, activeEntry?.startTime]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      await stopTimer();
    } catch (err) {
      console.error("Failed to stop timer:", err);
    } finally {
      setStopping(false);
    }
  }, []);

  // The timer endpoint may return the entry with or without task relations,
  // so we extract the title defensively via unknown.
  const rawEntry = activeEntry as unknown as
    | { task?: { title?: string } }
    | null
    | undefined;
  const taskTitle = rawEntry?.task?.title ?? "Timer running";

  return (
    <AnimatePresence>
      {isRunning && activeEntry && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="
            fixed top-0 inset-x-0 z-[60]
            h-10 bg-slate-900 text-white
            flex items-center justify-center gap-4
            px-4 text-sm shadow-lg
          "
        >
          {/* Pulsing dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8FF00] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8FF00]" />
          </span>

          {/* Task title */}
          <span className="truncate max-w-[200px] sm:max-w-xs text-slate-300 text-xs">
            {taskTitle}
          </span>

          {/* Elapsed time */}
          <span className="font-mono text-sm font-semibold tabular-nums tracking-wider text-white">
            {formatElapsed(elapsed)}
          </span>

          {/* Stop button */}
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className="
              ml-2 px-3 py-1 rounded-md text-xs font-medium
              bg-[#C8FF00] text-slate-900 hover:bg-[#A3D600]
              transition-colors active:scale-[0.97]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {stopping ? "Stopping..." : "Stop"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
