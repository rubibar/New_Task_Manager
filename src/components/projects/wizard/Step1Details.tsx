"use client";

import { useState, useRef, useEffect } from "react";
import type { ProjectType } from "@/types";

const COLORS = [
  "#C8FF00", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6",
  "#EC4899", "#10B981", "#6366F1", "#F97316", "#14B8A6",
];

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
];

export interface Step1Data {
  name: string;
  clientName: string;
  description: string;
  projectTypeId: string;
  startDate: string;
  targetFinishDate: string;
  budget: string;
  shiftRate: string;
  hourlyRate: string;
  status: string;
  color: string;
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  projectTypes: ProjectType[];
  clientNames: string[];
  errors: Record<string, string>;
}

export function Step1Details({
  data,
  onChange,
  projectTypes,
  clientNames,
  errors,
}: Step1Props) {
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filteredClients = clientNames.filter(
    (name) =>
      name.toLowerCase().includes(data.clientName.toLowerCase()) &&
      name.toLowerCase() !== data.clientName.toLowerCase()
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        clientInputRef.current &&
        !clientInputRef.current.contains(e.target as Node)
      ) {
        setShowClientSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const update = (field: keyof Step1Data, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent ${
      errors[field] ? "border-red-300 bg-red-50" : "border-slate-200"
    }`;

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">
          Project Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g., Brand Campaign Q1"
          className={inputClass("name")}
        />
        {errors.name && (
          <span className="text-xs text-red-500">{errors.name}</span>
        )}
      </div>

      {/* Client Name with autocomplete */}
      <div className="flex flex-col gap-1.5 relative">
        <label className="text-sm font-medium text-slate-700">
          Client Name <span className="text-red-400">*</span>
        </label>
        <input
          ref={clientInputRef}
          type="text"
          value={data.clientName}
          onChange={(e) => {
            update("clientName", e.target.value);
            setShowClientSuggestions(true);
          }}
          onFocus={() => setShowClientSuggestions(true)}
          placeholder="e.g., Acme Corp"
          className={inputClass("clientName")}
        />
        {errors.clientName && (
          <span className="text-xs text-red-500">{errors.clientName}</span>
        )}
        {showClientSuggestions && filteredClients.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto"
          >
            {filteredClients.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  update("clientName", name);
                  setShowClientSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
          placeholder="What's this project about?"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent resize-none"
        />
      </div>

      {/* Project Type + Status row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Project Type
          </label>
          <select
            value={data.projectTypeId}
            onChange={(e) => update("projectTypeId", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          >
            <option value="">Select type...</option>
            {projectTypes.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select
            value={data.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Start Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={data.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            className={inputClass("startDate")}
          />
          {errors.startDate && (
            <span className="text-xs text-red-500">{errors.startDate}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Target Finish Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={data.targetFinishDate}
            onChange={(e) => update("targetFinishDate", e.target.value)}
            className={inputClass("targetFinishDate")}
          />
          {errors.targetFinishDate && (
            <span className="text-xs text-red-500">
              {errors.targetFinishDate}
            </span>
          )}
        </div>
      </div>

      {/* Budget row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="number"
              value={data.budget}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="0"
              min="0"
              step="100"
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Shift Rate
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="number"
              value={data.shiftRate}
              onChange={(e) => update("shiftRate", e.target.value)}
              placeholder="0"
              min="0"
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Hourly Rate
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="number"
              value={data.hourlyRate}
              onChange={(e) => update("hourlyRate", e.target.value)}
              placeholder="0"
              min="0"
              className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update("color", c)}
              className={`w-7 h-7 rounded-full transition-all ${
                data.color === c
                  ? "ring-2 ring-offset-2 ring-slate-800 scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
