"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useClients, createClient } from "@/hooks/useClients";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ClientWithRelations } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECTIVE" | "ARCHIVED";
type ViewMode = "table" | "cards";

const STATUS_COLORS: Record<ClientStatus, { dot: string; badge: string; text: string }> = {
  ACTIVE:      { dot: "bg-green-500",  badge: "bg-green-50 text-green-700 border-green-200",  text: "Active" },
  INACTIVE:    { dot: "bg-slate-400",  badge: "bg-slate-50 text-slate-600 border-slate-200",  text: "Inactive" },
  PROSPECTIVE: { dot: "bg-blue-500",   badge: "bg-blue-50 text-blue-700 border-blue-200",     text: "Prospective" },
  ARCHIVED:    { dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 border-amber-200",  text: "Archived" },
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL",         label: "All Statuses" },
  { value: "ACTIVE",      label: "Active" },
  { value: "INACTIVE",    label: "Inactive" },
  { value: "PROSPECTIVE", label: "Prospective" },
  { value: "ARCHIVED",    label: "Archived" },
];

const CLIENT_TYPE_OPTIONS = [
  "Studio", "Agency", "Brand", "Individual", "Production House", "Other",
];

const SOURCE_OPTIONS = [
  "Referral", "Website", "Social Media", "Cold Outreach", "Event", "Other",
];

/* ------------------------------------------------------------------ */
/*  Helper: format currency                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Helper: format date                                                */
/* ------------------------------------------------------------------ */

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "--";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: ClientStatus }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.INACTIVE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${s.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p
        className={`text-xl font-semibold ${
          accent ? "text-[#C8FF00]" : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG icons                                                          */
/* ------------------------------------------------------------------ */

function SearchIcon() {
  return (
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
  );
}

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#0f172a" : "#94a3b8"}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#0f172a" : "#94a3b8"}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Client Modal                                                */
/* ------------------------------------------------------------------ */

interface CreateFormState {
  name: string;
  email: string;
  contactPerson: string;
  phone: string;
  clientType: string;
  source: string;
  industry: string;
  status: ClientStatus;
  tags: string;
  notes: string;
}

const INITIAL_FORM: CreateFormState = {
  name: "",
  email: "",
  contactPerson: "",
  phone: "",
  clientType: "",
  source: "",
  industry: "",
  status: "PROSPECTIVE",
  tags: "",
  notes: "",
};

function CreateClientModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof CreateFormState>(
    key: K,
    value: CreateFormState[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        clientType: form.clientType || undefined,
        source: form.source || undefined,
        industry: form.industry.trim() || undefined,
        status: form.status,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: form.notes.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
      };

      const created = await createClient(payload);
      setForm(INITIAL_FORM);
      onClose();
      router.push(`/clients/${created.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create client"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setError("");
    onClose();
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <Modal open={open} onClose={handleClose} title="New Client" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Name + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Client name"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="client@example.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 2: Contact + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contact Person</label>
            <input
              type="text"
              value={form.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
              placeholder="Primary contact name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+972..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 3: Client Type + Source */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Client Type</label>
            <select
              value={form.clientType}
              onChange={(e) => set("clientType", e.target.value)}
              className={inputClass}
            >
              <option value="">Select type...</option>
              {CLIENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Source</label>
            <select
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              className={inputClass}
            >
              <option value="">Select source...</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4: Industry + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Industry</label>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="e.g. Entertainment"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as ClientStatus)}
              className={inputClass}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PROSPECTIVE">Prospective</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass}>Tags</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="tag1, tag2, tag3"
            className={inputClass}
          />
          <p className="text-[10px] text-slate-400 mt-1">Comma-separated</p>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Additional notes..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Create Client
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Client Table Row                                                   */
/* ------------------------------------------------------------------ */

function ClientTableRow({ client }: { client: ClientWithRelations }) {
  const router = useRouter();
  const status = (client.status || "INACTIVE") as ClientStatus;
  const primaryContact = client.contacts?.find((c) => c.isPrimary) || client.contacts?.[0];

  return (
    <tr
      onClick={() => router.push(`/clients/${client.id}`)}
      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
    >
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              STATUS_COLORS[status]?.dot || "bg-slate-400"
            }`}
          />
          <span className="text-sm font-medium text-slate-800">
            {client.name}
          </span>
        </div>
      </td>

      {/* Primary Contact */}
      <td className="px-4 py-3">
        {primaryContact ? (
          <div>
            <p className="text-sm text-slate-700">{primaryContact.name}</p>
            {primaryContact.email && (
              <p className="text-xs text-slate-400">{primaryContact.email}</p>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">--</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>

      {/* Active Projects */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-slate-700">
          {client._count?.projects ?? 0}
        </span>
      </td>

      {/* Total Revenue */}
      <td className="px-4 py-3">
        <span className="text-sm text-slate-700">
          {formatCurrency(client._count?.invoices ?? 0)}
        </span>
      </td>

      {/* Last Communication */}
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500">
          {formatDate((client as Record<string, unknown>).lastCommunicationAt as string | undefined)}
        </span>
      </td>

      {/* Tags */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap">
          {(client.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600"
            >
              {tag}
            </span>
          ))}
          {(client.tags || []).length > 3 && (
            <span className="text-[10px] text-slate-400">
              +{client.tags.length - 3}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Client Card (grid view)                                            */
/* ------------------------------------------------------------------ */

function ClientCard({ client }: { client: ClientWithRelations }) {
  const router = useRouter();
  const status = (client.status || "INACTIVE") as ClientStatus;
  const primaryContact = client.contacts?.find((c) => c.isPrimary) || client.contacts?.[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={() => router.push(`/clients/${client.id}`)}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 cursor-pointer transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">
          {client.name}
        </h3>
        <StatusBadge status={status} />
      </div>

      {/* Contact */}
      {primaryContact && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-slate-500">
              {primaryContact.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-700 truncate">
              {primaryContact.name}
            </p>
            {primaryContact.role && (
              <p className="text-[10px] text-slate-400 truncate">
                {primaryContact.role}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          >
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
          </svg>
          <span className="text-xs text-slate-600">
            {client._count?.projects ?? 0} projects
          </span>
        </div>
        <div className="flex items-center gap-1">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <span className="text-xs text-slate-600">
            {formatCurrency(client._count?.invoices ?? 0)}
          </span>
        </div>
      </div>

      {/* Tags */}
      {client.tags && client.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {client.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600"
            >
              {tag}
            </span>
          ))}
          {client.tags.length > 3 && (
            <span className="text-[10px] text-slate-400">
              +{client.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-slate-100 rounded w-32 animate-pulse" />
        <div className="h-9 bg-slate-100 rounded w-28 animate-pulse" />
      </div>

      {/* Search/filter bar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-8 bg-slate-100 rounded w-56 animate-pulse" />
        <div className="h-8 bg-slate-100 rounded w-36 animate-pulse" />
        <div className="h-8 bg-slate-100 rounded w-20 animate-pulse" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-100 p-4 animate-pulse"
          >
            <div className="h-3 bg-slate-100 rounded w-20 mb-2" />
            <div className="h-6 bg-slate-100 rounded w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-100 p-4 animate-pulse flex items-center gap-4"
          >
            <div className="h-4 bg-slate-100 rounded w-40" />
            <div className="h-4 bg-slate-100 rounded w-28" />
            <div className="h-4 bg-slate-100 rounded w-20" />
            <div className="h-4 bg-slate-100 rounded w-12" />
            <div className="h-4 bg-slate-100 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export default function ClientsPage() {
  const { data: session } = useSession();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [createOpen, setCreateOpen] = useState(false);

  const { clients, isLoading } = useClients({
    search,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  /* Compute stats */
  const stats = useMemo(() => {
    const all = clients || [];
    const active = all.filter((c) => c.status === "ACTIVE").length;
    const prospective = all.filter((c) => c.status === "PROSPECTIVE").length;
    const totalRevenue = all.reduce(
      (sum, c) => sum + (c._count?.invoices ?? 0),
      0
    );
    return { total: all.length, active, prospective, totalRevenue };
  }, [clients]);

  /* ---- Auth gate ---- */
  if (!session) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-4">
            Sign in to access the CRM
          </p>
          <a href="/login">
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  /* ---- Loading ---- */
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Clients</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Client</Button>
      </div>

      {/* ---- Search + Filters + View toggle ---- */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`p-1.5 transition-colors ${
              viewMode === "table"
                ? "bg-slate-100"
                : "hover:bg-slate-50"
            }`}
            title="Table view"
          >
            <TableIcon active={viewMode === "table"} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`p-1.5 transition-colors ${
              viewMode === "cards"
                ? "bg-slate-100"
                : "hover:bg-slate-50"
            }`}
            title="Card view"
          >
            <GridIcon active={viewMode === "cards"} />
          </button>
        </div>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={stats.total} />
        <StatCard label="Active Clients" value={stats.active} accent />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
        />
        <StatCard label="Prospective" value={stats.prospective} />
      </div>

      {/* ---- Empty State ---- */}
      {clients.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm mb-3">
            {search || statusFilter !== "ALL"
              ? "No clients match your search or filters."
              : "No clients yet. Add your first client to get started."}
          </p>
          {!search && statusFilter === "ALL" && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              Add Client
            </Button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* ---- Table View ---- */
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Primary Contact
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Last Contact
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Tags
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {clients.map((client) => (
                  <ClientTableRow key={client.id} client={client} />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        /* ---- Card View ---- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ---- Create Modal ---- */}
      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
