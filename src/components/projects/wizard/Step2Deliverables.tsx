"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TaskTemplate, UserWithCapacity } from "@/types";

export interface DeliverableInput {
  name: string;
  description: string;
  dueDate: string;
  status: string;
  assigneeId: string;
}

export interface CustomTaskInput {
  name: string;
  category: string;
  assigneeId: string;
  estimatedHours: string;
  priority: string;
  dueDate: string;
}

export interface Step2Data {
  deliverables: DeliverableInput[];
  selectedTemplateIds: string[];
  customTasks: CustomTaskInput[];
}

interface Step2Props {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  templates: TaskTemplate[];
  users: UserWithCapacity[];
}

const DELIVERABLE_STATUSES = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "DELIVERED", label: "Delivered" },
];

const PRIORITY_OPTIONS = [
  { value: "IMPORTANT_NOT_URGENT", label: "Medium" },
  { value: "URGENT_IMPORTANT", label: "High" },
  { value: "URGENT_NOT_IMPORTANT", label: "Low" },
  { value: "NEITHER", label: "Low" },
];

const CATEGORY_LABELS: Record<string, string> = {
  PRE_PRODUCTION: "Pre-Production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-Production",
  ADMIN: "Admin",
};

function groupTemplates(templates: TaskTemplate[]) {
  const groups: Record<string, TaskTemplate[]> = {};
  for (const t of templates) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
}

const emptyDeliverable: DeliverableInput = {
  name: "",
  description: "",
  dueDate: "",
  status: "NOT_STARTED",
  assigneeId: "",
};

const emptyCustomTask: CustomTaskInput = {
  name: "",
  category: "PRODUCTION",
  assigneeId: "",
  estimatedHours: "",
  priority: "IMPORTANT_NOT_URGENT",
  dueDate: "",
};

export function Step2Deliverables({
  data,
  onChange,
  templates,
  users,
}: Step2Props) {
  const [showAddTask, setShowAddTask] = useState(false);
  const grouped = groupTemplates(templates);

  const addDeliverable = () => {
    onChange({
      ...data,
      deliverables: [...data.deliverables, { ...emptyDeliverable }],
    });
  };

  const updateDeliverable = (
    index: number,
    field: keyof DeliverableInput,
    value: string
  ) => {
    const updated = [...data.deliverables];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, deliverables: updated });
  };

  const removeDeliverable = (index: number) => {
    onChange({
      ...data,
      deliverables: data.deliverables.filter((_, i) => i !== index),
    });
  };

  const toggleTemplate = (id: string) => {
    const selected = new Set(data.selectedTemplateIds);
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    onChange({ ...data, selectedTemplateIds: Array.from(selected) });
  };

  const toggleCategory = (category: string) => {
    const categoryIds = (grouped[category] || []).map((t) => t.id);
    const allSelected = categoryIds.every((id) =>
      data.selectedTemplateIds.includes(id)
    );
    const selected = new Set(data.selectedTemplateIds);
    for (const id of categoryIds) {
      if (allSelected) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
    }
    onChange({ ...data, selectedTemplateIds: Array.from(selected) });
  };

  const addCustomTask = () => {
    onChange({
      ...data,
      customTasks: [...data.customTasks, { ...emptyCustomTask }],
    });
    setShowAddTask(true);
  };

  const updateCustomTask = (
    index: number,
    field: keyof CustomTaskInput,
    value: string
  ) => {
    const updated = [...data.customTasks];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, customTasks: updated });
  };

  const removeCustomTask = (index: number) => {
    onChange({
      ...data,
      customTasks: data.customTasks.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      {/* Deliverables Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Deliverables
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define what you&apos;ll deliver to the client
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={addDeliverable}>
            + Add Deliverable
          </Button>
        </div>

        {data.deliverables.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <p className="text-xs text-slate-400">
              No deliverables yet. Click &quot;Add Deliverable&quot; to start.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.deliverables.map((del, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-3 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={del.name}
                      onChange={(e) =>
                        updateDeliverable(i, "name", e.target.value)
                      }
                      placeholder="Deliverable name"
                      className="w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="date"
                        value={del.dueDate}
                        onChange={(e) =>
                          updateDeliverable(i, "dueDate", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
                      />
                      <select
                        value={del.status}
                        onChange={(e) =>
                          updateDeliverable(i, "status", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      >
                        {DELIVERABLE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={del.assigneeId}
                        onChange={(e) =>
                          updateDeliverable(i, "assigneeId", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={del.description}
                      onChange={(e) =>
                        updateDeliverable(i, "description", e.target.value)
                      }
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDeliverable(i)}
                    className="text-slate-300 hover:text-red-500 transition-colors mt-1"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Templates Section */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Task Checklist
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select standard tasks for this project. Selected tasks will be added
            to the project board.
          </p>
        </div>

        <div className="space-y-4">
          {Object.entries(grouped).map(([category, categoryTemplates]) => {
            const categoryIds = categoryTemplates.map((t) => t.id);
            const allSelected = categoryIds.every((id) =>
              data.selectedTemplateIds.includes(id)
            );
            const someSelected = categoryIds.some((id) =>
              data.selectedTemplateIds.includes(id)
            );

            return (
              <div
                key={category}
                className="rounded-lg border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      allSelected
                        ? "bg-[#C8FF00] border-[#C8FF00]"
                        : someSelected
                        ? "bg-[#C8FF00]/30 border-[#C8FF00]"
                        : "border-slate-300"
                    }`}
                  >
                    {(allSelected || someSelected) && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={allSelected ? "#1e293b" : "#65a30d"}
                        strokeWidth="3"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {CATEGORY_LABELS[category] || category}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {
                      categoryIds.filter((id) =>
                        data.selectedTemplateIds.includes(id)
                      ).length
                    }
                    /{categoryIds.length}
                  </span>
                </button>

                <div className="divide-y divide-slate-100">
                  {categoryTemplates.map((tmpl) => {
                    const isSelected = data.selectedTemplateIds.includes(
                      tmpl.id
                    );
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => toggleTemplate(tmpl.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                          isSelected ? "bg-[#C8FF00]/5" : ""
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-[#C8FF00] border-[#C8FF00]"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#1e293b"
                              strokeWidth="3"
                            >
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-slate-700 flex-1">
                          {tmpl.name}
                        </span>
                        {tmpl.estimatedHours && (
                          <span className="text-[10px] text-slate-400">
                            ~{tmpl.estimatedHours}h
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Custom Tasks
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add one-off tasks specific to this project
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={addCustomTask}>
            + Add Task
          </Button>
        </div>

        {data.customTasks.length === 0 && !showAddTask ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-400">
              No custom tasks. Click &quot;Add Task&quot; to add project-specific
              tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.customTasks.map((task, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-3 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={task.name}
                      onChange={(e) =>
                        updateCustomTask(i, "name", e.target.value)
                      }
                      placeholder="Task name"
                      className="w-full px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <select
                        value={task.priority}
                        onChange={(e) =>
                          updateCustomTask(i, "priority", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      >
                        {PRIORITY_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={task.assigneeId}
                        onChange={(e) =>
                          updateCustomTask(i, "assigneeId", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={task.estimatedHours}
                        onChange={(e) =>
                          updateCustomTask(i, "estimatedHours", e.target.value)
                        }
                        placeholder="Hours"
                        min="0"
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      />
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) =>
                          updateCustomTask(i, "dueDate", e.target.value)
                        }
                        className="px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#C8FF00]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustomTask(i)}
                    className="text-slate-300 hover:text-red-500 transition-colors mt-1"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
