"use client";

import { useState, useCallback, useMemo } from "react";
import type { TaskWithRelations } from "@/types";

export interface FilterState {
  projects: string[];
  assignees: string[];
  statuses: string[];
  priorities: string[];
  search: string;
  dateFrom: string;
  dateTo: string;
}

const defaultFilters: FilterState = {
  projects: [],
  assignees: [],
  statuses: [],
  priorities: [],
  search: "",
  dateFrom: "",
  dateTo: "",
};

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.projects.length > 0 ||
      filters.assignees.length > 0 ||
      filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.search.trim() !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== ""
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.projects.length > 0) count++;
    if (filters.assignees.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.search.trim()) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  }, [filters]);

  const applyFilters = useCallback(
    (tasks: TaskWithRelations[]): TaskWithRelations[] => {
      let result = tasks;

      // Project filter
      if (filters.projects.length > 0) {
        result = result.filter(
          (t) => t.projectId && filters.projects.includes(t.projectId)
        );
      }

      // Assignee filter
      if (filters.assignees.length > 0) {
        result = result.filter((t) => filters.assignees.includes(t.ownerId));
      }

      // Status filter
      if (filters.statuses.length > 0) {
        result = result.filter((t) => filters.statuses.includes(t.status));
      }

      // Priority filter
      if (filters.priorities.length > 0) {
        result = result.filter((t) => filters.priorities.includes(t.priority));
      }

      // Search
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.owner.name.toLowerCase().includes(q) ||
            t.project?.name.toLowerCase().includes(q)
        );
      }

      // Date range
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        result = result.filter((t) => new Date(t.deadline) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        result = result.filter((t) => new Date(t.startDate) <= to);
      }

      return result;
    },
    [filters]
  );

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
  };
}
