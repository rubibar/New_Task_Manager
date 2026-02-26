"use client";

import type { Step1Data } from "./Step1Details";
import type { Step2Data } from "./Step2Deliverables";
import type { Step4Data, FolderNode } from "./Step4Folders";
import type { ProjectType, TaskTemplate, UserWithCapacity } from "@/types";

interface Step5Props {
  step1Data: Step1Data;
  step2Data: Step2Data;
  step4Data: Step4Data;
  projectTypes: ProjectType[];
  templates: TaskTemplate[];
  users: UserWithCapacity[];
  onJumpToStep: (step: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
};

const CATEGORY_LABELS: Record<string, string> = {
  PRE_PRODUCTION: "Pre-Production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-Production",
  ADMIN: "Admin",
};

function countFolders(node: FolderNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countFolders(child);
    }
  }
  return count;
}

function SectionHeader({
  title,
  step,
  onEdit,
}: {
  title: string;
  step: number;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-[#65a30d] hover:text-[#4d7c0f] font-medium"
      >
        Edit Step {step}
      </button>
    </div>
  );
}

export function Step5Review({
  step1Data,
  step2Data,
  step4Data,
  projectTypes,
  templates,
  users,
  onJumpToStep,
}: Step5Props) {
  const projectType = projectTypes.find((pt) => pt.id === step1Data.projectTypeId);
  const selectedTemplates = templates.filter((t) =>
    step2Data.selectedTemplateIds.includes(t.id)
  );
  const validDeliverables = step2Data.deliverables.filter((d) => d.name.trim());
  const validCustomTasks = step2Data.customTasks.filter((t) => t.name.trim());
  const getUserName = (id: string) =>
    users.find((u) => u.id === id)?.name || "Unassigned";

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-slate-50 px-4 py-3 border border-slate-200">
        <p className="text-xs text-slate-500">
          Review everything before creating the project. Click
          &quot;Edit&quot; on any section to go back and make changes.
        </p>
      </div>

      {/* Project Details */}
      <div className="rounded-lg border border-slate-200 p-4">
        <SectionHeader
          title="Project Details"
          step={1}
          onEdit={() => onJumpToStep(1)}
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Name
            </span>
            <p className="text-sm text-slate-800">{step1Data.name || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Client
            </span>
            <p className="text-sm text-slate-800">
              {step1Data.clientName || "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Type
            </span>
            <p className="text-sm text-slate-800">
              {projectType?.name || "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Status
            </span>
            <p className="text-sm text-slate-800">
              {STATUS_LABELS[step1Data.status] || step1Data.status}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Start
            </span>
            <p className="text-sm text-slate-800">
              {step1Data.startDate || "—"}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Target Finish
            </span>
            <p className="text-sm text-slate-800">
              {step1Data.targetFinishDate || "—"}
            </p>
          </div>
          {step1Data.budget && (
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-medium">
                Budget
              </span>
              <p className="text-sm text-slate-800">
                ${Number(step1Data.budget).toLocaleString()}
              </p>
            </div>
          )}
          {step1Data.shiftRate && (
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-medium">
                Shift Rate
              </span>
              <p className="text-sm text-slate-800">
                ${Number(step1Data.shiftRate).toLocaleString()}/shift
              </p>
            </div>
          )}
          {step1Data.hourlyRate && (
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-medium">
                Hourly Rate
              </span>
              <p className="text-sm text-slate-800">
                ${Number(step1Data.hourlyRate).toLocaleString()}/hr
              </p>
            </div>
          )}
        </div>
        {step1Data.description && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] uppercase text-slate-400 font-medium">
              Description
            </span>
            <p className="text-xs text-slate-600 mt-0.5">
              {step1Data.description}
            </p>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: step1Data.color }}
          />
          <span className="text-xs text-slate-500">Project color</span>
        </div>
      </div>

      {/* Deliverables */}
      <div className="rounded-lg border border-slate-200 p-4">
        <SectionHeader
          title={`Deliverables (${validDeliverables.length})`}
          step={2}
          onEdit={() => onJumpToStep(2)}
        />
        {validDeliverables.length === 0 ? (
          <p className="text-xs text-slate-400">No deliverables added</p>
        ) : (
          <div className="space-y-1.5">
            {validDeliverables.map((del, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-slate-50 rounded px-3 py-2"
              >
                <span className="text-slate-700 font-medium">{del.name}</span>
                <div className="flex items-center gap-3 text-slate-400">
                  {del.dueDate && <span>{del.dueDate}</span>}
                  {del.assigneeId && (
                    <span>{getUserName(del.assigneeId)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="rounded-lg border border-slate-200 p-4">
        <SectionHeader
          title={`Tasks (${selectedTemplates.length + validCustomTasks.length})`}
          step={2}
          onEdit={() => onJumpToStep(2)}
        />
        {selectedTemplates.length === 0 && validCustomTasks.length === 0 ? (
          <p className="text-xs text-slate-400">No tasks selected</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const catTemplates = selectedTemplates.filter(
                (t) => t.category === cat
              );
              if (catTemplates.length === 0) return null;
              return (
                <div key={cat}>
                  <span className="text-[10px] uppercase text-slate-400 font-medium">
                    {label}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {catTemplates.map((t) => (
                      <span
                        key={t.id}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                      >
                        {t.name}
                        {t.estimatedHours ? ` (~${t.estimatedHours}h)` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {validCustomTasks.length > 0 && (
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-medium">
                  Custom Tasks
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {validCustomTasks.map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Folder Structure */}
      {step4Data.folderStructure && (
        <div className="rounded-lg border border-slate-200 p-4">
          <SectionHeader
            title="Folder Structure"
            step={4}
            onEdit={() => onJumpToStep(4)}
          />
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>{countFolders(step4Data.folderStructure)} folders</span>
            {step4Data.basePath && (
              <span>
                Path: <code className="text-slate-600">{step4Data.basePath}</code>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
