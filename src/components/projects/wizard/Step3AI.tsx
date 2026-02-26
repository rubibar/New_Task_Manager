"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import type { Step1Data } from "./Step1Details";
import type { Step2Data } from "./Step2Deliverables";
import type { WizardInsightResponse } from "@/lib/ai/types";
import type { ProjectType, TaskTemplate, UserWithCapacity } from "@/types";

interface Step3Props {
  step1Data: Step1Data;
  step2Data: Step2Data;
  projectTypes: ProjectType[];
  templates: TaskTemplate[];
  users: UserWithCapacity[];
  onAcceptMilestones: (milestones: { name: string; dueDate: string }[]) => void;
  onAcceptTasks: (taskNames: string[]) => void;
}

const RISK_COLORS = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
};

export function Step3AI({
  step1Data,
  step2Data,
  projectTypes,
  templates,
  users,
  onAcceptMilestones,
  onAcceptTasks,
}: Step3Props) {
  const [insights, setInsights] = useState<WizardInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptedMilestones, setAcceptedMilestones] = useState<Set<number>>(new Set());
  const [acceptedTasks, setAcceptedTasks] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);

  const projectType = projectTypes.find((pt) => pt.id === step1Data.projectTypeId);
  const selectedTemplates = templates.filter((t) =>
    step2Data.selectedTemplateIds.includes(t.id)
  );

  const totalTemplates = step2Data.selectedTemplateIds.length;
  const totalDeliverables = step2Data.deliverables.filter((d) => d.name.trim()).length;
  const totalCustomTasks = step2Data.customTasks.filter((t) => t.name.trim()).length;

  const generateInsights = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/wizard-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1Data.name,
          clientName: step1Data.clientName,
          description: step1Data.description,
          projectType: projectType?.name,
          startDate: step1Data.startDate,
          targetFinishDate: step1Data.targetFinishDate,
          budget: step1Data.budget || null,
          hourlyRate: step1Data.hourlyRate || null,
          shiftRate: step1Data.shiftRate || null,
          deliverables: step2Data.deliverables
            .filter((d) => d.name.trim())
            .map((d) => ({ name: d.name, dueDate: d.dueDate })),
          selectedTaskNames: selectedTemplates.map((t) => t.name),
          teamMembers: users.map((u) => ({ id: u.id, name: u.name })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate insights");
      }

      const data = await res.json();
      setInsights(data);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }, [step1Data, step2Data, projectType, selectedTemplates, users]);

  // Auto-generate on first mount
  useEffect(() => {
    if (!hasGenerated && !loading && step1Data.name) {
      generateInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMilestone = (index: number) => {
    const next = new Set(Array.from(acceptedMilestones));
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setAcceptedMilestones(next);
    if (insights) {
      const accepted = insights.suggestedMilestones
        .filter((_, i) => next.has(i))
        .map((m) => ({ name: m.name, dueDate: m.suggestedDate }));
      onAcceptMilestones(accepted);
    }
  };

  const toggleTask = (index: number) => {
    const next = new Set(Array.from(acceptedTasks));
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setAcceptedTasks(next);
    if (insights) {
      const accepted = insights.suggestedTasks
        .filter((_, i) => next.has(i))
        .map((t) => t.name);
      onAcceptTasks(accepted);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quick Stats */}
      <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          Project Snapshot
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <div className="text-lg font-bold text-slate-800">
              {totalTemplates + totalCustomTasks}
            </div>
            <div className="text-xs text-slate-500">Tasks</div>
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
              <div className="text-xs text-slate-500">Days</div>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-lg border border-slate-200 p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-[#C8FF00] rounded-full mx-auto mb-3" />
          <p className="text-sm text-slate-500">Analyzing project setup...</p>
          <p className="text-xs text-slate-400 mt-1">
            Generating insights, risk flags, and suggestions
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={generateInsights}>
            Retry
          </Button>
        </div>
      )}

      {/* AI Results */}
      {insights && !loading && (
        <>
          {/* Summary */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">
              AI Summary
            </h4>
            <p className="text-sm text-slate-600">{insights.projectSummary}</p>
          </div>

          {/* Risk Flags */}
          {insights.riskFlags.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Risk Flags
              </h4>
              <div className="space-y-2">
                {insights.riskFlags.map((rf, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                      RISK_COLORS[rf.severity]
                    }`}
                  >
                    <span className="font-semibold shrink-0 mt-px">
                      {rf.severity}
                    </span>
                    <span>{rf.flag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hours Estimate */}
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-xs font-semibold text-slate-700 mb-2">
              Hours Estimate
            </h4>
            <div className="flex items-center gap-4 mb-2">
              <div className="text-2xl font-bold text-slate-800">
                {insights.hoursEstimate.totalHours}h
              </div>
              <span className="text-xs text-slate-400">estimated total</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {insights.hoursEstimate.breakdown.map((b, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  {b.category}: {b.hours}h
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              {insights.hoursEstimate.assumptions}
            </p>
          </div>

          {/* Suggested Milestones */}
          {insights.suggestedMilestones.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Suggested Milestones
              </h4>
              <p className="text-[10px] text-slate-400 mb-3">
                Click to accept milestones — they&apos;ll be added to your
                project.
              </p>
              <div className="space-y-2">
                {insights.suggestedMilestones.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleMilestone(i)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      acceptedMilestones.has(i)
                        ? "border-[#C8FF00] bg-[#C8FF00]/10"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        acceptedMilestones.has(i)
                          ? "bg-[#C8FF00] border-[#C8FF00]"
                          : "border-slate-300"
                      }`}
                    >
                      {acceptedMilestones.has(i) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-slate-700">
                        {m.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {m.suggestedDate} — {m.reasoning}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Tasks */}
          {insights.suggestedTasks.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Suggested Additional Tasks
              </h4>
              <p className="text-[10px] text-slate-400 mb-3">
                Tasks you might have missed. Click to include them.
              </p>
              <div className="space-y-2">
                {insights.suggestedTasks.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleTask(i)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      acceptedTasks.has(i)
                        ? "border-[#C8FF00] bg-[#C8FF00]/10"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        acceptedTasks.has(i)
                          ? "bg-[#C8FF00] border-[#C8FF00]"
                          : "border-slate-300"
                      }`}
                    >
                      {acceptedTasks.has(i) && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-slate-700">
                        {t.name}
                        <span className="ml-2 text-[10px] text-slate-400">
                          ~{t.estimatedHours}h
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.category.replace(/_/g, " ")} — {t.reasoning}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Team Allocation */}
          {insights.teamAllocation.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Suggested Team Allocation
              </h4>
              <div className="space-y-2">
                {insights.teamAllocation.map((ta, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-slate-700 mb-1">
                      {ta.memberName}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {ta.suggestedTasks.map((t, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">{ta.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benchmarks */}
          {insights.benchmarks?.available && insights.benchmarks.comparisons.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                Historical Benchmarks
              </h4>
              <div className="space-y-1">
                {insights.benchmarks.comparisons.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-slate-50 rounded px-3 py-2"
                  >
                    <span className="text-slate-700 font-medium">
                      {c.projectName}
                    </span>
                    <div className="flex gap-3 text-slate-400">
                      <span>{c.duration} days</span>
                      <span>{c.taskCount} tasks</span>
                      {c.budget && <span>${c.budget.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regenerate */}
          <div className="text-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={generateInsights}
            >
              Regenerate Insights
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
