"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useDeliverableTemplates,
  createDeliverableTemplate,
  updateDeliverableTemplate,
  deleteDeliverableTemplate,
  seedDeliverableTemplates,
} from "@/hooks/useDeliverableTemplates";
import type { DeliverableTemplate } from "@/types";
import type { DeliverableTemplateDefaultTask } from "@/types";

const PHASE_LABELS: Record<string, string> = {
  PRE_PRODUCTION: "Pre-Production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-Production",
  ADMIN: "Admin",
};

const PHASE_OPTIONS = [
  { value: "PRE_PRODUCTION", label: "Pre-Production" },
  { value: "PRODUCTION", label: "Production" },
  { value: "POST_PRODUCTION", label: "Post-Production" },
  { value: "ADMIN", label: "Admin" },
];

const PHASE_COLORS: Record<string, string> = {
  PRE_PRODUCTION: "bg-blue-50 text-blue-700 border-blue-200",
  PRODUCTION: "bg-amber-50 text-amber-700 border-amber-200",
  POST_PRODUCTION: "bg-purple-50 text-purple-700 border-purple-200",
  ADMIN: "bg-slate-50 text-slate-600 border-slate-200",
};

interface EditingTemplate {
  id?: string;
  name: string;
  phase: string;
  sortOrder: number;
  defaultTasks: DeliverableTemplateDefaultTask[];
  isActive: boolean;
}

const emptyTemplate: EditingTemplate = {
  name: "",
  phase: "PRE_PRODUCTION",
  sortOrder: 0,
  defaultTasks: [],
  isActive: true,
};

export function DeliverableTemplateManager() {
  const { templates, isLoading } = useDeliverableTemplates(true);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<EditingTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const grouped = templates.reduce<Record<string, DeliverableTemplate[]>>(
    (acc, t) => {
      const phase = t.phase;
      if (!acc[phase]) acc[phase] = [];
      acc[phase].push(t);
      return acc;
    },
    {}
  );

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDeliverableTemplates();
    } catch {
      // ignore — already seeded
    } finally {
      setSeeding(false);
    }
  };

  const handleEdit = (t: DeliverableTemplate) => {
    setEditing({
      id: t.id,
      name: t.name,
      phase: t.phase,
      sortOrder: t.sortOrder,
      defaultTasks: (t.defaultTasks as unknown as DeliverableTemplateDefaultTask[]) || [],
      isActive: t.isActive,
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await updateDeliverableTemplate(editing.id, {
          name: editing.name.trim(),
          phase: editing.phase,
          sortOrder: editing.sortOrder,
          defaultTasks: editing.defaultTasks,
          isActive: editing.isActive,
        });
      } else {
        await createDeliverableTemplate({
          name: editing.name.trim(),
          phase: editing.phase,
          sortOrder: editing.sortOrder,
          defaultTasks: editing.defaultTasks,
        });
      }
      setEditing(null);
    } catch {
      // handle error silently
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template permanently?")) return;
    await deleteDeliverableTemplate(id);
  };

  const handleToggleActive = async (t: DeliverableTemplate) => {
    await updateDeliverableTemplate(t.id, { isActive: !t.isActive });
  };

  const addDefaultTask = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      defaultTasks: [
        ...editing.defaultTasks,
        { title: "", phase: editing.phase as DeliverableTemplateDefaultTask["phase"], sortOrder: editing.defaultTasks.length + 1 },
      ],
    });
  };

  const updateDefaultTask = (
    index: number,
    field: keyof DeliverableTemplateDefaultTask,
    value: string | number
  ) => {
    if (!editing) return;
    const tasks = [...editing.defaultTasks];
    tasks[index] = { ...tasks[index], [field]: value };
    setEditing({ ...editing, defaultTasks: tasks });
  };

  const removeDefaultTask = (index: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      defaultTasks: editing.defaultTasks.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <h2 className="text-sm font-semibold text-slate-800">
            Deliverable Templates
          </h2>
          <span className="text-[10px] text-slate-400">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          {/* Seed button if empty */}
          {templates.length === 0 && !isLoading && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">
                No templates yet. Seed the default animation pipeline templates?
              </p>
              <Button size="sm" onClick={handleSeed} loading={seeding}>
                Seed Default Templates
              </Button>
            </div>
          )}

          {/* Template list grouped by phase */}
          {Object.entries(PHASE_LABELS).map(([phase, label]) => {
            const phaseTemplates = grouped[phase];
            if (!phaseTemplates?.length) return null;
            return (
              <div key={phase}>
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  {label}
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {phaseTemplates.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        t.isActive
                          ? PHASE_COLORS[t.phase] || PHASE_COLORS.ADMIN
                          : "bg-slate-50 text-slate-400 border-slate-100 opacity-60"
                      }`}
                    >
                      <span className="text-xs font-medium flex-1">
                        {t.name}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {(t.defaultTasks as unknown as DeliverableTemplateDefaultTask[])?.length || 0} tasks
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t)}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          t.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {t.isActive ? "Active" : "Inactive"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(t)}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="text-[10px] text-slate-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add / Edit Form */}
          {editing ? (
            <div className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-700">
                {editing.id ? "Edit Template" : "New Template"}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="Template name"
                  className="col-span-1 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                />
                <select
                  value={editing.phase}
                  onChange={(e) =>
                    setEditing({ ...editing, phase: e.target.value })
                  }
                  className="px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                >
                  {PHASE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Sort order"
                  className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                />
              </div>

              {/* Default Tasks */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">
                    Default Tasks
                  </span>
                  <button
                    type="button"
                    onClick={addDefaultTask}
                    className="text-[10px] text-[#65a30d] hover:text-[#4d7c0f] font-medium"
                  >
                    + Add Task
                  </button>
                </div>
                {editing.defaultTasks.length === 0 ? (
                  <p className="text-[10px] text-slate-400 py-2">
                    No default tasks. Add tasks that will be auto-created.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {editing.defaultTasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-4">
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) =>
                            updateDefaultTask(i, "title", e.target.value)
                          }
                          placeholder="Task title"
                          className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                        />
                        <select
                          value={task.phase}
                          onChange={(e) =>
                            updateDefaultTask(i, "phase", e.target.value)
                          }
                          className="px-1.5 py-1 rounded border border-slate-200 text-[10px] bg-white"
                        >
                          {PHASE_OPTIONS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeDefaultTask(i)}
                          className="text-slate-300 hover:text-red-500"
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
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" onClick={handleSave} loading={saving}>
                  {editing.id ? "Update" : "Create"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing({ ...emptyTemplate })}
            >
              + New Template
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
