import useSWR, { mutate } from "swr";
import type {
  TimeEntryWithRelations,
  CreateTimeEntryInput,
  TimeEntry,
} from "@/types";

// ---------------------------------------------------------------------------
// Fetcher (same pattern as useTasks)
// ---------------------------------------------------------------------------

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ---------------------------------------------------------------------------
// Key helpers — allow targeted & wildcard revalidation
// ---------------------------------------------------------------------------

const TIME_ENTRIES_KEY = "/api/time-entries";
const TIMER_KEY = "/api/time-entries/timer";
const SUMMARY_KEY = "/api/time-entries/summary";

function isTimeEntryKey(key: unknown): boolean {
  return typeof key === "string" && key.startsWith(TIME_ENTRIES_KEY);
}

/** Revalidate all time-entry related SWR keys. */
async function revalidateAll() {
  await mutate(isTimeEntryKey);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

interface TimeEntryFilters {
  taskId?: string;
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * List time entries with optional filters.
 * No auto-refresh — historical data changes infrequently.
 */
export function useTimeEntries(filters?: TimeEntryFilters) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  const qs = params.toString();
  const url = `${TIME_ENTRIES_KEY}${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading } = useSWR<TimeEntryWithRelations[]>(
    url,
    fetcher,
    { refreshInterval: 0 }
  );

  return {
    entries: data || [],
    isLoading,
    isError: !!error,
  };
}

interface TimeSummaryParams {
  groupBy: "task" | "project" | "user" | "day";
  taskId?: string;
  projectId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get aggregated time data grouped by the specified dimension.
 */
export function useTimeSummary(params: TimeSummaryParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const url = `${SUMMARY_KEY}?${searchParams.toString()}`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    refreshInterval: 0,
  });

  return {
    summary: data || [],
    isLoading,
    isError: !!error,
  };
}

/**
 * Get the currently active timer.
 * No polling — elapsed time is calculated client-side via setInterval.
 * Revalidates on window focus so the UI catches external stop/start events.
 */
export function useActiveTimer() {
  const { data, error, isLoading } = useSWR<{
    activeEntry: TimeEntry | null;
    isRunning: boolean;
  }>(TIMER_KEY, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: true,
  });

  return {
    activeEntry: data?.activeEntry ?? null,
    isRunning: data?.isRunning ?? false,
    isLoading,
    isError: !!error,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Start a timer for the given task. */
export async function startTimer(taskId: string): Promise<TimeEntry> {
  const res = await fetch(TIMER_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to start timer");
  }

  const entry: TimeEntry = await res.json();
  await revalidateAll();
  return entry;
}

/** Stop the active timer. Optionally attach a note. */
export async function stopTimer(note?: string): Promise<TimeEntry> {
  const res = await fetch(TIMER_KEY, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to stop timer");
  }

  const entry: TimeEntry = await res.json();
  await revalidateAll();
  return entry;
}

/** Create a manual time entry. */
export async function createManualEntry(
  input: CreateTimeEntryInput
): Promise<TimeEntry> {
  const res = await fetch(TIME_ENTRIES_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create time entry");
  }

  const entry: TimeEntry = await res.json();
  await revalidateAll();
  return entry;
}

/** Update an existing time entry. */
export async function updateTimeEntry(
  id: string,
  data: Partial<CreateTimeEntryInput>
): Promise<TimeEntry> {
  const res = await fetch(`${TIME_ENTRIES_KEY}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update time entry");
  }

  const entry: TimeEntry = await res.json();
  await revalidateAll();
  return entry;
}

/** Delete a time entry. */
export async function deleteTimeEntry(id: string): Promise<void> {
  const res = await fetch(`${TIME_ENTRIES_KEY}/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to delete time entry");
  }

  await revalidateAll();
}
