import useSWR, { mutate } from "swr";
import type { TaskWithRelations, CreateTaskInput, UpdateTaskInput } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useTasks(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  const url = `/api/tasks${params.toString() ? `?${params}` : ""}`;

  const { data, error, isLoading } = useSWR<TaskWithRelations[]>(url, fetcher, {
    refreshInterval: 30000, // Refresh every 30s
  });

  return {
    tasks: data || [],
    isLoading,
    isError: !!error,
  };
}

export function useTask(id: string | null) {
  const { data, error, isLoading } = useSWR<TaskWithRelations>(
    id ? `/api/tasks/${id}` : null,
    fetcher
  );

  return {
    task: data,
    isLoading,
    isError: !!error,
  };
}

export async function createTask(input: CreateTaskInput) {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to create task");

  await mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to update task");

  await mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}

export async function deleteTask(id: string) {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });

  if (!res.ok) throw new Error("Failed to delete task");

  await mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"));
}

export async function changeTaskStatus(id: string, status: string) {
  const res = await fetch(`/api/tasks/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error("Failed to change status");

  await mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}

export async function toggleEmergency(id: string) {
  const res = await fetch(`/api/tasks/${id}/emergency`, { method: "POST" });

  if (!res.ok) throw new Error("Failed to toggle emergency");

  await mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}
