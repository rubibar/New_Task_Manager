import useSWR from "swr";
import type { Milestone } from "@prisma/client";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useMilestones() {
  const { data, error, isLoading } = useSWR<Milestone[]>(
    "/api/milestones",
    fetcher
  );

  return {
    milestones: data ?? [],
    isLoading,
    error,
  };
}
