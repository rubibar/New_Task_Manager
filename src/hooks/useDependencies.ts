import { mutate } from "swr";

export async function addDependency(taskId: string, dependsOnId: string) {
  const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dependsOnId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add dependency");
  }
  // Invalidate both tasks
  mutate(`/api/tasks/${taskId}`);
  mutate(`/api/tasks/${dependsOnId}`);
  // Invalidate task list
  mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}

export async function removeDependency(taskId: string, dependsOnId: string) {
  const res = await fetch(
    `/api/tasks/${taskId}/dependencies?dependsOnId=${dependsOnId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to remove dependency");
  mutate(`/api/tasks/${taskId}`);
  mutate(`/api/tasks/${dependsOnId}`);
  mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/tasks"));
  return res.json();
}
