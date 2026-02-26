"use client";

import { useState, useRef, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { Button } from "@/components/ui/Button";
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
  clientId: string;
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
  errors,
}: Step1Props) {
  const [clientSearch, setClientSearch] = useState(data.clientName || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddEmail, setQuickAddEmail] = useState("");
  const [quickAddContact, setQuickAddContact] = useState("");
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { clients } = useClients({ search: clientSearch });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const update = (field: keyof Step1Data, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const selectClient = (client: { id: string; name: string }) => {
    onChange({ ...data, clientId: client.id, clientName: client.name });
    setClientSearch(client.name);
    setShowDropdown(false);
  };

  const clearClient = () => {
    onChange({ ...data, clientId: "", clientName: "" });
    setClientSearch("");
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) return;
    setQuickAddLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickAddName.trim(),
          email: quickAddEmail.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create client");
      const newClient = await res.json();

      // Create primary contact if provided
      if (quickAddContact.trim()) {
        await fetch(`/api/clients/${newClient.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: quickAddContact.trim(),
            email: quickAddEmail.trim() || undefined,
            isPrimary: true,
          }),
        });
      }

      selectClient({ id: newClient.id, name: newClient.name });
      setShowQuickAdd(false);
      setQuickAddName("");
      setQuickAddEmail("");
      setQuickAddContact("");
    } catch {
      // silently fail — user can retry
    } finally {
      setQuickAddLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent ${
      errors[field] ? "border-red-300 bg-red-50" : "border-slate-200"
    }`;

  // Find primary contact for matched clients
  const getContactInfo = (client: { contacts?: { name: string; isPrimary: boolean }[] }) => {
    const primary = client.contacts?.find((c: { isPrimary: boolean }) => c.isPrimary);
    return primary?.name || client.contacts?.[0]?.name || "";
  };

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

      {/* Client — CRM-linked searchable dropdown */}
      <div className="flex flex-col gap-1.5 relative">
        <label className="text-sm font-medium text-slate-700">
          Client <span className="text-red-400">*</span>
        </label>
        {data.clientId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-slate-800 font-medium flex-1">
              {data.clientName}
            </span>
            <button
              type="button"
              onClick={clearClient}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                onChange({ ...data, clientName: e.target.value, clientId: "" });
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search clients or type a new name..."
              className={inputClass("clientName")}
            />
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto"
              >
                {clients.length > 0 ? (
                  <>
                    {clients.slice(0, 8).map((client: { id: string; name: string; status: string; contacts?: { name: string; isPrimary: boolean }[] }) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => selectClient(client)}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          client.status === "ACTIVE" ? "bg-green-500" :
                          client.status === "PROSPECTIVE" ? "bg-blue-500" :
                          "bg-slate-400"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {client.name}
                          </div>
                          {getContactInfo(client) && (
                            <div className="text-[10px] text-slate-400">
                              {getContactInfo(client)}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {client.status}
                        </span>
                      </button>
                    ))}
                  </>
                ) : clientSearch.trim() ? (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    No clients match &quot;{clientSearch}&quot;
                  </div>
                ) : null}

                {/* Quick-add option */}
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setQuickAddName(clientSearch);
                    setShowQuickAdd(true);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-[#65a30d] hover:bg-[#C8FF00]/10 font-medium border-t border-slate-100 flex items-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add New Client{clientSearch.trim() ? `: "${clientSearch}"` : ""}
                </button>
              </div>
            )}
          </>
        )}
        {errors.clientName && (
          <span className="text-xs text-red-500">{errors.clientName}</span>
        )}

        {/* Quick-add inline form */}
        {showQuickAdd && (
          <div className="rounded-lg border border-[#C8FF00] bg-[#C8FF00]/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Quick Add Client</span>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
            <input
              type="text"
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder="Company name *"
              className="w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={quickAddContact}
                onChange={(e) => setQuickAddContact(e.target.value)}
                placeholder="Contact person"
                className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
              />
              <input
                type="email"
                value={quickAddEmail}
                onChange={(e) => setQuickAddEmail(e.target.value)}
                placeholder="Email"
                className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
              />
            </div>
            <Button
              size="sm"
              onClick={handleQuickAdd}
              loading={quickAddLoading}
              disabled={!quickAddName.trim()}
            >
              Create & Select
            </Button>
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
