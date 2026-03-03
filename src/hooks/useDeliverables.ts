import useSWR, { mutate } from "swr";
import type { DeliverableWithRelations } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useDeliverables(projectId: string | null) {
  const { data, error, isLoading } = useSWR<DeliverableWithRelations[]>(
    projectId ? `/api/deliverables?projectId=${projectId}` : null,
    fetcher
  );

  return {
    deliverables: data || [],
    error,
    isLoading,
  };
}

export async function resequenceDeliverable(deliverableId: string) {
  const res = await fetch(`/api/deliverables/${deliverableId}/sequence`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to resequence");
  // Invalidate deliverables cache
  mutate((key: unknown) => typeof key === "string" && key.includes("/api/deliverables"));
  return res.json();
}
