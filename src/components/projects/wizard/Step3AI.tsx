"use client";

import type { Step1Data } from "./Step1Details";
import type { Step2Data } from "./Step2Deliverables";

interface Step3Props {
  step1Data: Step1Data;
  step2Data: Step2Data;
}

export function Step3AI({ step1Data, step2Data }: Step3Props) {
  const totalTemplates = step2Data.selectedTemplateIds.length;
  const totalDeliverables = step2Data.deliverables.filter(
    (d) => d.name.trim()
  ).length;
  const totalCustomTasks = step2Data.customTasks.filter(
    (t) => t.name.trim()
  ).length;

  return (
    <div className="space-y-6">
      {/* Quick Summary */}
      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Project Snapshot
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="text-lg font-bold text-slate-800">
              {totalTemplates + totalCustomTasks}
            </div>
            <div className="text-xs text-slate-500">Tasks planned</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="text-lg font-bold text-slate-800">
              {totalDeliverables}
            </div>
            <div className="text-xs text-slate-500">Deliverables</div>
          </div>
          {step1Data.budget && (
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <div className="text-lg font-bold text-slate-800">
                ${Number(step1Data.budget).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">Budget</div>
            </div>
          )}
          {step1Data.startDate && step1Data.targetFinishDate && (
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <div className="text-lg font-bold text-slate-800">
                {Math.ceil(
                  (new Date(step1Data.targetFinishDate).getTime() -
                    new Date(step1Data.startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                )}
              </div>
              <div className="text-xs text-slate-500">Days timeline</div>
            </div>
          )}
        </div>
      </div>

      {/* AI Placeholder */}
      <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
          >
            <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z" />
            <circle cx="9" cy="12" r="1" fill="#94a3b8" />
            <circle cx="15" cy="12" r="1" fill="#94a3b8" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-600 mb-1">
          AI Insights Coming Soon
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          AI-powered project analysis, risk flags, suggested milestones, task
          timeline optimization, and team allocation will be available here.
        </p>
      </div>

      {/* Manual Insights */}
      {step1Data.startDate &&
        step1Data.targetFinishDate &&
        totalTemplates + totalCustomTasks > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 9v4m0 4h.01M12 2L2 22h20L12 2z" />
              </svg>
              Quick Check
            </h4>
            <ul className="space-y-1">
              {(() => {
                const days = Math.ceil(
                  (new Date(step1Data.targetFinishDate).getTime() -
                    new Date(step1Data.startDate).getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                const taskCount = totalTemplates + totalCustomTasks;
                const flags: string[] = [];

                if (days < 7 && taskCount > 5) {
                  flags.push(
                    `Tight timeline: ${taskCount} tasks in ${days} days`
                  );
                }
                if (days < 3 && totalDeliverables > 2) {
                  flags.push(
                    `${totalDeliverables} deliverables in under 3 days may be ambitious`
                  );
                }
                if (taskCount > 15 && !step1Data.budget) {
                  flags.push(
                    "Large project with no budget set — consider adding one"
                  );
                }

                if (flags.length === 0) {
                  return (
                    <li className="text-xs text-amber-700">
                      No obvious risks detected. Looks good!
                    </li>
                  );
                }

                return flags.map((flag, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    {flag}
                  </li>
                ));
              })()}
            </ul>
          </div>
        )}
    </div>
  );
}
