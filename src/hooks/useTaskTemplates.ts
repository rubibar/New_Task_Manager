import useSWR from "swr";
import type { TaskTemplateWithChecklist } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useTaskTemplates() {
  const { data, error, isLoading } = useSWR<TaskTemplateWithChecklist[]>(
    "/api/task-templates",
    fetcher
  );

  return {
    templates: data || [],
    isLoading,
    isError: !!error,
  };
}
