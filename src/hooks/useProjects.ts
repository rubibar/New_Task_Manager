import useSWR, { mutate } from "swr";
import type { ProjectWithTasks } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useProjects() {
  const { data, error, isLoading } = useSWR<ProjectWithTasks[]>(
    "/api/projects",
    fetcher
  );

  return {
    projects: data || [],
    isLoading,
    isError: !!error,
  };
}

export async function createProject(input: {
  name: string;
  description?: string;
  color?: string;
}) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to create project");

  await mutate("/api/projects");
  return res.json();
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string; color?: string; status?: string }
) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error("Failed to update project");

  await mutate("/api/projects");
  return res.json();
}

export async function deleteProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete project");
  }

  await mutate("/api/projects");
}
