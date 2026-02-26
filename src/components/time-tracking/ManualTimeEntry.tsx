"use client";

import { useState, useCallback, type FormEvent } from "react";
import { createManualEntry } from "@/hooks/useTimeEntries";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ManualTimeEntryProps {
  /** Pre-selected task ID. If omitted the user must type one. */
  taskId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return today in YYYY-MM-DD format for the date input default. */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Combine a YYYY-MM-DD date and HH:MM time into an ISO datetime string. */
function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ManualTimeEntry({
  taskId: prefilledTaskId,
  onSuccess,
  onCancel,
}: ManualTimeEntryProps) {
  // Form state
  const [taskId, setTaskId] = useState(prefilledTaskId ?? "");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<"range" | "duration">("range");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!taskId.trim()) {
        setError("Task ID is required.");
        return;
      }

      setSubmitting(true);
      try {
        if (mode === "range") {
          await createManualEntry({
            taskId: taskId.trim(),
            startTime: combineDateAndTime(date, startTime),
            endTime: combineDateAndTime(date, endTime),
            entryType: "MANUAL",
            billable,
            note: note.trim() || undefined,
          });
        } else {
          const totalSeconds =
            (parseInt(hours, 10) || 0) * 3600 +
            (parseInt(minutes, 10) || 0) * 60;

          if (totalSeconds <= 0) {
            setError("Duration must be greater than zero.");
            setSubmitting(false);
            return;
          }

          await createManualEntry({
            taskId: taskId.trim(),
            startTime: combineDateAndTime(date, startTime),
            duration: totalSeconds,
            entryType: "MANUAL",
            billable,
            note: note.trim() || undefined,
          });
        }

        onSuccess?.();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create entry."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [taskId, date, mode, startTime, endTime, hours, minutes, billable, note, onSuccess]
  );

  // ------- Shared input styles -------
  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent transition-shadow";

  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Task ID */}
      {!prefilledTaskId && (
        <div>
          <label className={labelClass}>Task ID</label>
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="Paste task ID"
            className={inputClass}
            required
          />
        </div>
      )}

      {/* Date */}
      <div>
        <label className={labelClass}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          required
        />
      </div>

      {/* Mode toggle */}
      <div>
        <label className={labelClass}>Time input</label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMode("range")}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              mode === "range"
                ? "bg-[#C8FF00] text-slate-900"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            Start / End
          </button>
          <button
            type="button"
            onClick={() => setMode("duration")}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              mode === "duration"
                ? "bg-[#C8FF00] text-slate-900"
                : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            Duration
          </button>
        </div>
      </div>

      {/* Start / End or Duration */}
      {mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>End time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Hours</label>
            <input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Minutes</label>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Billable toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">Billable</label>
        <button
          type="button"
          role="switch"
          aria-checked={billable}
          onClick={() => setBillable(!billable)}
          className={`
            relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
            border-2 border-transparent transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF00]
            ${billable ? "bg-[#C8FF00]" : "bg-slate-200"}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-4 w-4 transform rounded-full
              bg-white shadow ring-0 transition duration-200 ease-in-out
              ${billable ? "translate-x-4" : "translate-x-0"}
            `}
          />
        </button>
      </div>

      {/* Note */}
      <div>
        <label className={labelClass}>Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you work on?"
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm" loading={submitting}>
          Add Entry
        </Button>
      </div>
    </form>
  );
}
