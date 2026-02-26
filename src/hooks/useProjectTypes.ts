import useSWR, { mutate } from "swr";
import type { ProjectType } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useProjectTypes() {
  const { data, error, isLoading } = useSWR<ProjectType[]>(
    "/api/project-types",
    fetcher
  );

  return {
    projectTypes: data || [],
    isLoading,
    isError: !!error,
  };
}

export async function createProjectType(name: string) {
  const res = await fetch("/api/project-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) throw new Error("Failed to create project type");

  await mutate("/api/project-types");
  return res.json();
}
