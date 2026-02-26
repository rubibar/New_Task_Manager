"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { useProjects } from "@/hooks/useProjects";
import type { FilterState } from "@/hooks/useFilters";
import type { UserWithCapacity } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "URGENT_IMPORTANT", label: "Urgent" },
  { value: "IMPORTANT_NOT_URGENT", label: "High" },
  { value: "URGENT_NOT_IMPORTANT", label: "Medium" },
  { value: "NEITHER", label: "Low" },
];

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
          selected.length > 0
            ? "border-[#C8FF00] bg-[#C8FF00]/10 text-slate-800"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-[#C8FF00] text-slate-900 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-semibold">
            {selected.length}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 min-w-[180px] max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                  selected.includes(opt.value)
                    ? "bg-[#C8FF00] border-[#C8FF00]"
                    : "border-slate-300"
                }`}
              >
                {selected.includes(opt.value) && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              {opt.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span className="text-xs text-slate-700">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onFilterChange,
  onClear,
  hasActiveFilters,
  activeFilterCount,
}: FilterBarProps) {
  const { projects } = useProjects();
  const { data: users } = useSWR<UserWithCapacity[]>("/api/users", fetcher);

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.name,
    color: p.color,
  }));

  const assigneeOptions = (users || []).map((u) => ({
    value: u.id,
    label: u.name,
  }));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          className="absolute left-2.5 top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFilterChange("search", e.target.value)}
          placeholder="Search..."
          className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-44 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
        />
      </div>

      {/* Multi-selects */}
      <MultiSelect
        label="Project"
        options={projectOptions}
        selected={filters.projects}
        onChange={(v) => onFilterChange("projects", v)}
      />
      <MultiSelect
        label="Assignee"
        options={assigneeOptions}
        selected={filters.assignees}
        onChange={(v) => onFilterChange("assignees", v)}
      />
      <MultiSelect
        label="Status"
        options={STATUS_OPTIONS}
        selected={filters.statuses}
        onChange={(v) => onFilterChange("statuses", v)}
      />
      <MultiSelect
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={filters.priorities}
        onChange={(v) => onFilterChange("priorities", v)}
      />

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFilterChange("dateFrom", e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          title="From date"
        />
        <span className="text-xs text-slate-400">-</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFilterChange("dateTo", e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          title="To date"
        />
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Clear ({activeFilterCount})
        </button>
      )}
    </div>
  );
}
