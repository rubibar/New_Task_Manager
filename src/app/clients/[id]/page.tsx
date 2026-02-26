"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { mutate } from "swr";
import { useClient, updateClient, deleteClient } from "@/hooks/useClients";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isPrimary: boolean;
}

interface ProjectWithCount {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  targetFinishDate?: string | null;
  budget?: number | null;
  _count: { tasks: number };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  dateIssued: string;
  dueDate: string;
  projectId?: string | null;
  project?: { name: string } | null;
  total: number;
  paymentDate?: string | null;
}

interface Communication {
  id: string;
  type: string;
  subject: string;
  description?: string | null;
  date: string;
  participants: string[];
  followUpDate?: string | null;
}

interface ClientWithRelations {
  id: string;
  name: string;
  status: string;
  clientType: string;
  source: string;
  industry?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  tags: string[];
  notes?: string | null;
  logoUrl?: string | null;
  contacts: Contact[];
  projects: ProjectWithCount[];
  invoices: Invoice[];
  communications: Communication[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = "projects" | "financial" | "communications" | "deliverables" | "activity";

const TABS: { key: TabKey; label: string }[] = [
  { key: "projects", label: "Projects" },
  { key: "financial", label: "Financial" },
  { key: "communications", label: "Communications" },
  { key: "deliverables", label: "Deliverables" },
  { key: "activity", label: "Activity" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-600",
  PROSPECTIVE: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-amber-100 text-amber-700",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
};

const COMMUNICATION_TYPE_ICONS: Record<string, string> = {
  EMAIL: "\u{1F4E7}",
  CALL: "\u{1F4DE}",
  MEETING: "\u{1F91D}",
  VIDEO_CALL: "\u{1F4F9}",
  CHAT: "\u{1F4AC}",
  NOTE: "\u{1F4DD}",
};

const COMMUNICATION_TYPES = [
  { value: "EMAIL", label: "Email" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "VIDEO_CALL", label: "Video Call" },
  { value: "CHAT", label: "Chat" },
  { value: "NOTE", label: "Note" },
];

const CLIENT_TYPES = [
  { value: "AGENCY", label: "Agency" },
  { value: "DIRECT_CLIENT", label: "Direct Client" },
  { value: "INTERNAL", label: "Internal" },
  { value: "FREELANCE_PARTNER", label: "Freelance Partner" },
  { value: "OTHER", label: "Other" },
];

const CLIENT_SOURCES = [
  { value: "REFERRAL", label: "Referral" },
  { value: "INBOUND", label: "Inbound" },
  { value: "COLD_OUTREACH", label: "Cold Outreach" },
  { value: "REPEAT", label: "Repeat" },
  { value: "OTHER", label: "Other" },
];

const CLIENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "PROSPECTIVE", label: "Prospective" },
  { value: "ARCHIVED", label: "Archived" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string | null | undefined): string {
  if (!d) return "--";
  return new Date(d).toLocaleDateString("en-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "--";
  return new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Tag color palette for chips
const TAG_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-lime-100 text-lime-700",
  "bg-cyan-100 text-cyan-700",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ---------------------------------------------------------------------------
// Deliverable Type (fetched client-side)
// ---------------------------------------------------------------------------

interface Deliverable {
  id: string;
  name: string;
  projectId: string;
  status: string;
  dueDate: string;
  assignee?: { id: string; name: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Sub-components: Loading / Error
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-pulse space-y-6">
      <div className="h-4 w-40 bg-slate-200 rounded" />
      <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-4">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="h-4 w-48 bg-slate-100 rounded" />
        <div className="h-4 w-80 bg-slate-100 rounded" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-28 bg-slate-200 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-slate-100 rounded-xl" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-8">
      <Link
        href="/clients"
        className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        &larr; Back to Clients
      </Link>
      <div className="mt-16 text-center">
        <p className="text-lg font-medium text-slate-700">Client not found</p>
        <p className="text-sm text-slate-500 mt-1">
          The client you are looking for does not exist or has been removed.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Client Modal
// ---------------------------------------------------------------------------

function EditClientModal({
  client,
  open,
  onClose,
}: {
  client: ClientWithRelations;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: client.name,
    status: client.status,
    clientType: client.clientType,
    source: client.source,
    industry: client.industry || "",
    email: client.email || "",
    phone: client.phone || "",
    website: client.website || "",
    address: client.address || "",
    tags: client.tags.join(", "),
    notes: client.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateClient(client.id, {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onClose();
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Client" maxWidth="max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FieldSelect
          label="Status"
          value={form.status}
          options={CLIENT_STATUSES}
          onChange={(v) => setForm({ ...form, status: v })}
        />
        <FieldSelect
          label="Client Type"
          value={form.clientType}
          options={CLIENT_TYPES}
          onChange={(v) => setForm({ ...form, clientType: v })}
        />
        <FieldSelect
          label="Source"
          value={form.source}
          options={CLIENT_SOURCES}
          onChange={(v) => setForm({ ...form, source: v })}
        />
        <FieldInput label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
        <FieldInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
        <FieldInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
        <FieldInput label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} type="url" />
        <div className="sm:col-span-2">
          <FieldInput label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </div>
        <div className="sm:col-span-2">
          <FieldInput
            label="Tags (comma separated)"
            value={form.tags}
            onChange={(v) => setForm({ ...form, tags: v })}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldTextarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Contact Modal (Add / Edit)
// ---------------------------------------------------------------------------

function ContactModal({
  open,
  onClose,
  clientId,
  contact,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  contact?: Contact | null;
}) {
  const [form, setForm] = useState({
    name: contact?.name || "",
    role: contact?.role || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    notes: contact?.notes || "",
    isPrimary: contact?.isPrimary || false,
  });
  const [saving, setSaving] = useState(false);

  const isEdit = !!contact;

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = isEdit
        ? `/api/clients/${clientId}/contacts/${contact!.id}`
        : `/api/clients/${clientId}/contacts`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
      onClose();
    } catch {
      // keep open
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Contact" : "Add Contact"}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <FieldInput label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <FieldInput label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} />
        <FieldInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
        <FieldInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
        <FieldTextarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
            className="rounded border-slate-300 text-[#C8FF00] focus:ring-[#C8FF00]"
          />
          Primary contact
        </label>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={handleSave}>
          {isEdit ? "Update" : "Add Contact"}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Communication Modal (Add)
// ---------------------------------------------------------------------------

function CommunicationModal({
  open,
  onClose,
  clientId,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  contacts: Contact[];
}) {
  const [form, setForm] = useState({
    type: "EMAIL",
    subject: "",
    description: "",
    date: new Date().toISOString().slice(0, 16),
    followUpDate: "",
    participants: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          followUpDate: form.followUpDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
      onClose();
    } catch {
      // keep open
    } finally {
      setSaving(false);
    }
  };

  const toggleParticipant = (name: string) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.includes(name)
        ? prev.participants.filter((p) => p !== name)
        : [...prev.participants, name],
    }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Communication" maxWidth="max-w-lg">
      <div className="space-y-4">
        <FieldSelect
          label="Type"
          value={form.type}
          options={COMMUNICATION_TYPES}
          onChange={(v) => setForm({ ...form, type: v })}
        />
        <FieldInput
          label="Subject *"
          value={form.subject}
          onChange={(v) => setForm({ ...form, subject: v })}
        />
        <FieldTextarea
          label="Description"
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Date</label>
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Follow-up Date (optional)</label>
          <input
            type="datetime-local"
            value={form.followUpDate}
            onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          />
        </div>
        {contacts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Participants</label>
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleParticipant(c.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.participants.includes(c.name)
                      ? "bg-[#C8FF00] border-[#C8FF00] text-slate-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} onClick={handleSave}>
          Add Entry
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  clientName,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  loading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Client" maxWidth="max-w-sm">
      <p className="text-sm text-slate-600">
        Are you sure you want to delete <strong>{clientName}</strong>? This action cannot be undone
        and will remove all associated contacts, communications, and invoices.
      </p>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent resize-none"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Projects
// ---------------------------------------------------------------------------

function ProjectsTab({ projects }: { projects: ProjectWithCount[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="This client does not have any projects associated with it."
        actionLabel="+ New Project"
        actionHref="/projects"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">
          {projects.length} Project{projects.length !== 1 ? "s" : ""}
        </h3>
        <Link href="/projects">
          <Button size="sm">+ New Project</Button>
        </Link>
      </div>
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects?id=${p.id}`}
          className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-medium text-slate-800 truncate">{p.name}</span>
              <Badge className={PROJECT_STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}>
                {humanize(p.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {(p.startDate || p.targetFinishDate) && (
                <span>
                  {formatDate(p.startDate)} &mdash; {formatDate(p.targetFinishDate)}
                </span>
              )}
              {p.budget != null && <span>{formatCurrency(p.budget)}</span>}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C8FF00] rounded-full transition-all"
                  style={{ width: `${p._count.tasks > 0 ? 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {p._count.tasks} task{p._count.tasks !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Financial
// ---------------------------------------------------------------------------

function FinancialTab({ invoices }: { invoices: Invoice[] }) {
  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const outstandingInvoices = invoices.filter(
    (i) => i.status === "SENT" || i.status === "OVERDUE"
  );
  const lifetimeRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
  const outstanding = outstandingInvoices.reduce((sum, i) => sum + i.total, 0);
  const avgProjectValue =
    paidInvoices.length > 0 ? lifetimeRevenue / paidInvoices.length : 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lifetime Revenue" value={formatCurrency(lifetimeRevenue)} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} />
        <StatCard label="Avg Invoice Value" value={formatCurrency(avgProjectValue)} />
        <StatCard label="Total Invoices" value={String(invoices.length)} />
      </div>

      {/* Invoice table */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Invoices</h3>
        <Button size="sm">+ New Invoice</Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="No invoices have been created for this client yet."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 font-medium text-slate-500">Invoice #</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Date</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Due Date</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Amount</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Status</th>
                <th className="text-left py-3 px-3 font-medium text-slate-500">Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 px-3 font-medium text-slate-800">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{formatDate(inv.dateIssued)}</td>
                  <td className="py-3 px-3 text-slate-600">{formatDate(inv.dueDate)}</td>
                  <td className="py-3 px-3 text-slate-800 font-medium">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className="py-3 px-3">
                    <Badge
                      className={
                        INVOICE_STATUS_COLORS[inv.status] || "bg-slate-100 text-slate-600"
                      }
                    >
                      {humanize(inv.status)}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {formatDate(inv.paymentDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Communications
// ---------------------------------------------------------------------------

function CommunicationsTab({
  communications,
  clientId,
  contacts,
}: {
  communications: Communication[];
  clientId: string;
  contacts: Contact[];
}) {
  const [filterType, setFilterType] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = filterType
    ? communications.filter((c) => c.type === filterType)
    : communications;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">Communication Log</h3>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          >
            <option value="">All Types</option>
            {COMMUNICATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          + Add Entry
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No communications"
          description={
            filterType
              ? "No entries match the selected filter."
              : "No communication entries have been logged for this client."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((comm) => (
            <div
              key={comm.id}
              className="bg-white rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">
                  {COMMUNICATION_TYPE_ICONS[comm.type] || "\u{1F4DD}"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{comm.subject}</span>
                    <span className="text-xs text-slate-500">{formatDate(comm.date)}</span>
                  </div>
                  {comm.description && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {comm.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge className="bg-slate-100 text-slate-600">
                      {humanize(comm.type)}
                    </Badge>
                    {comm.participants.length > 0 && (
                      <span className="text-xs text-slate-500">
                        {comm.participants.join(", ")}
                      </span>
                    )}
                    {comm.followUpDate && (
                      <span className="text-xs text-amber-600">
                        Follow-up: {formatDate(comm.followUpDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <CommunicationModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          clientId={clientId}
          contacts={contacts}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Deliverables
// ---------------------------------------------------------------------------

function DeliverablesTab({ projects }: { projects: ProjectWithCount[] }) {
  const [deliverables, setDeliverables] = useState<(Deliverable & { projectName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch deliverables for all projects on mount
  useEffect(() => {
    if (projects.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      try {
        const results = await Promise.all(
          projects.map(async (p) => {
            const res = await fetch(`/api/deliverables?projectId=${p.id}`);
            if (!res.ok) return [];
            const data: Deliverable[] = await res.json();
            return data.map((d) => ({ ...d, projectName: p.name }));
          })
        );
        if (!cancelled) setDeliverables(results.flat());
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <EmptyState
        title="No deliverables"
        description="There are no deliverables across this client's projects."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-3 font-medium text-slate-500">Deliverable</th>
            <th className="text-left py-3 px-3 font-medium text-slate-500">Project</th>
            <th className="text-left py-3 px-3 font-medium text-slate-500">Status</th>
            <th className="text-left py-3 px-3 font-medium text-slate-500">Due Date</th>
            <th className="text-left py-3 px-3 font-medium text-slate-500">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {deliverables.map((d) => (
            <tr
              key={d.id}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <td className="py-3 px-3 font-medium text-slate-800">{d.name}</td>
              <td className="py-3 px-3 text-slate-600">{d.projectName}</td>
              <td className="py-3 px-3">
                <Badge
                  className={
                    DELIVERABLE_STATUS_COLORS[d.status] || "bg-slate-100 text-slate-600"
                  }
                >
                  {humanize(d.status)}
                </Badge>
              </td>
              <td className="py-3 px-3 text-slate-600">{formatDate(d.dueDate)}</td>
              <td className="py-3 px-3 text-slate-600">{d.assignee?.name || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Activity (placeholder)
// ---------------------------------------------------------------------------

function ActivityTab() {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-slate-400">Activity log coming soon</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-slate-400"
        >
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4">
          <Button size="sm">{actionLabel}</Button>
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts Section (inline in header)
// ---------------------------------------------------------------------------

function ContactsSection({
  contacts,
  clientId,
}: {
  contacts: Contact[];
  clientId: string;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteContact = async (contactId: string) => {
    setDeletingId(contactId);
    try {
      const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      await mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/clients"));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Contacts</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          + Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-xs text-slate-400">No contacts added yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {c.name}
                  </span>
                  {c.isPrimary && (
                    <Badge className="bg-[#C8FF00]/20 text-slate-700 text-[10px]">
                      Primary
                    </Badge>
                  )}
                  {c.role && (
                    <span className="text-xs text-slate-500">{c.role}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingContact(c)}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Edit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteContact(c.id)}
                  disabled={deletingId === c.id}
                  className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <ContactModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          clientId={clientId}
        />
      )}
      {editingContact && (
        <ContactModal
          open={!!editingContact}
          onClose={() => setEditingContact(null)}
          clientId={clientId}
          contact={editingContact}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ClientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const { client, isLoading } = useClient(clientId) as {
    client: ClientWithRelations | null;
    isLoading: boolean;
  };

  const [activeTab, setActiveTab] = useState<TabKey>("projects");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteClient(clientId);
      router.push("/clients");
    } catch {
      setDeleting(false);
    }
  }, [clientId, router]);

  // --- Loading ---
  if (isLoading) return <LoadingSkeleton />;

  // --- Not found ---
  if (!client) return <NotFound />;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Clients
      </Link>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm"
      >
        <div className="p-6">
          {/* Top row: name, status, actions */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
                <Badge className={STATUS_COLORS[client.status] || "bg-slate-100 text-slate-600"}>
                  {humanize(client.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                <span>{humanize(client.clientType)}</span>
                {client.industry && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>{client.industry}</span>
                  </>
                )}
                <span className="text-slate-300">|</span>
                <span>Source: {humanize(client.source)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                Delete
              </Button>
            </div>
          </div>

          {/* Contact info row */}
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-600 flex-wrap">
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {client.email}
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                {client.phone}
              </a>
            )}
            {client.website && (
              <a
                href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                {client.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {client.address && (
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {client.address}
              </span>
            )}
          </div>

          {/* Tags */}
          {client.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1 font-medium">Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Contacts section */}
        <div className="border-t border-slate-200 px-6 py-5">
          <ContactsSection contacts={client.contacts} clientId={client.id} />
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="client-tab-underline"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[#C8FF00]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "projects" && <ProjectsTab projects={client.projects} />}
          {activeTab === "financial" && <FinancialTab invoices={client.invoices} />}
          {activeTab === "communications" && (
            <CommunicationsTab
              communications={client.communications}
              clientId={client.id}
              contacts={client.contacts}
            />
          )}
          {activeTab === "deliverables" && <DeliverablesTab projects={client.projects} />}
          {activeTab === "activity" && <ActivityTab />}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      {showEditModal && (
        <EditClientModal
          client={client}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}

      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        clientName={client.name}
        loading={deleting}
      />
    </div>
  );
}
