import useSWR from "swr";
import type { HealthScoreResult } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useProjectHealthScore(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<HealthScoreResult>(
    projectId ? `/api/projects/${projectId}/health-score` : null,
    fetcher
  );

  return {
    score: data ?? null,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

export function useClientHealthScore(clientId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<HealthScoreResult>(
    clientId ? `/api/clients/${clientId}/health-score` : null,
    fetcher
  );

  return {
    score: data ?? null,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

export async function recalculateProjectHealth(projectId: string) {
  const res = await fetch(`/api/projects/${projectId}/health-score`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to recalculate");
  return res.json() as Promise<HealthScoreResult>;
}

export async function recalculateClientHealth(clientId: string) {
  const res = await fetch(`/api/clients/${clientId}/health-score`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to recalculate");
  return res.json() as Promise<HealthScoreResult>;
}
