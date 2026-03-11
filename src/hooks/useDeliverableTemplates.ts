import useSWR, { mutate } from "swr";
import type { DeliverableTemplate } from "@/types";
import type { DeliverableTemplateDefaultTask } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const KEY = "/api/deliverable-templates";
const KEY_ALL = "/api/deliverable-templates?active=false";

export function useDeliverableTemplates(includeInactive = false) {
  const url = includeInactive ? KEY_ALL : KEY;
  const { data, error, isLoading } = useSWR<DeliverableTemplate[]>(url, fetcher);

  return {
    templates: data || [],
    isLoading,
    isError: !!error,
  };
}

function invalidate() {
  mutate((key: unknown) => typeof key === "string" && key.includes("/api/deliverable-templates"));
}

export async function createDeliverableTemplate(input: {
  name: string;
  phase: string;
  sortOrder?: number;
  defaultTasks?: DeliverableTemplateDefaultTask[];
}) {
  const res = await fetch(KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create template");
  invalidate();
  return res.json();
}

export async function updateDeliverableTemplate(
  id: string,
  input: Partial<{
    name: string;
    phase: string;
    sortOrder: number;
    defaultTasks: DeliverableTemplateDefaultTask[];
    isActive: boolean;
  }>
) {
  const res = await fetch(`${KEY.replace(/\?.*/, "")}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update template");
  invalidate();
  return res.json();
}

export async function deleteDeliverableTemplate(id: string) {
  const res = await fetch(`${KEY.replace(/\?.*/, "")}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete template");
  invalidate();
}

export async function seedDeliverableTemplates() {
  const res = await fetch("/api/deliverable-templates/seed", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to seed templates");
  invalidate();
  return res.json();
}
