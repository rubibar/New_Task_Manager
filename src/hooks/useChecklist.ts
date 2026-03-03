"use client";

import useSWR, { mutate } from "swr";
import type { ChecklistItem } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function checklistKey(taskId: string) {
  return `/api/tasks/${taskId}/checklist`;
}

function isChecklistKey(key: unknown): boolean {
  return typeof key === "string" && key.includes("/checklist");
}

export function useChecklist(taskId: string | null) {
  const { data, error, isLoading } = useSWR<ChecklistItem[]>(
    taskId ? checklistKey(taskId) : null,
    fetcher
  );

  return {
    items: data || [],
    isLoading,
    isError: !!error,
    total: data?.length || 0,
    completed: data?.filter((i) => i.completed).length || 0,
  };
}

export async function addChecklistItem(
  taskId: string,
  text: string
): Promise<ChecklistItem> {
  const res = await fetch(checklistKey(taskId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to add checklist item");
  const item = await res.json();
  await mutate(isChecklistKey);
  return item;
}

export async function toggleChecklistItem(
  taskId: string,
  itemId: string,
  completed: boolean
): Promise<ChecklistItem> {
  const res = await fetch(`${checklistKey(taskId)}/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error("Failed to update checklist item");
  const item = await res.json();
  await mutate(isChecklistKey);
  return item;
}

export async function updateChecklistItemText(
  taskId: string,
  itemId: string,
  text: string
): Promise<ChecklistItem> {
  const res = await fetch(`${checklistKey(taskId)}/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to update checklist item");
  const item = await res.json();
  await mutate(isChecklistKey);
  return item;
}

export async function deleteChecklistItem(
  taskId: string,
  itemId: string
): Promise<void> {
  const res = await fetch(`${checklistKey(taskId)}/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete checklist item");
  await mutate(isChecklistKey);
}

export async function reorderChecklistItems(
  taskId: string,
  itemIds: string[]
): Promise<void> {
  const res = await fetch(`${checklistKey(taskId)}/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder");
  await mutate(isChecklistKey);
}
