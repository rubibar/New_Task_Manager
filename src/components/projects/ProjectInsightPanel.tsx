"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import type { ProjectInsightResponse } from "@/lib/ai/types";

interface ProjectInsightPanelProps {
  projectId: string;
}

const RISK_COLORS = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

export function ProjectInsightPanel({ projectId }: ProjectInsightPanelProps) {
  const [insights, setInsights] = useState<ProjectInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchInsights = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/ai/project-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, refresh }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch insights");
        }
        const data = await res.json();
        setInsights(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate insights"
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // Initial state — not loaded yet
  if (!insights && !loading && !error) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C8FF00]/20 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#65a30d" strokeWidth="1.5">
            <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z" />
            <circle cx="9" cy="12" r="1" fill="#65a30d" />
            <circle cx="15" cy="12" r="1" fill="#65a30d" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">
          AI Project Analysis
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Get AI-powered insights on progress, risks, and recommendations
        </p>
        <Button size="sm" onClick={() => fetchInsights()}>
          Generate Insights
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-[#C8FF00] rounded-full mx-auto mb-3" />
        <p className="text-sm text-slate-500">Analyzing project...</p>
        <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <Button size="sm" variant="secondary" onClick={() => fetchInsights()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">AI Insights</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchInsights(true)}
        >
          Refresh
        </Button>
      </div>

      {/* Timeline Risk */}
      <div
        className={`rounded-lg border p-3 ${
          RISK_COLORS[insights.timelineRisk.level]
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase">
            {insights.timelineRisk.level} Risk
          </span>
        </div>
        <p className="text-xs">{insights.timelineRisk.explanation}</p>
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">Progress</h4>
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24" fill="none"
                stroke="#C8FF00" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - insights.progressAnalysis.overallPercent / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-800">
                {insights.progressAnalysis.overallPercent}%
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-600">
              {insights.progressAnalysis.assessment}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Done", value: insights.progressAnalysis.taskBreakdown.done, color: "text-green-600" },
            { label: "In Progress", value: insights.progressAnalysis.taskBreakdown.inProgress, color: "text-blue-600" },
            { label: "To Do", value: insights.progressAnalysis.taskBreakdown.todo, color: "text-slate-600" },
            { label: "Total", value: insights.progressAnalysis.taskBreakdown.total, color: "text-slate-800" },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded p-2">
              <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
              <div className="text-[10px] text-slate-400">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget */}
      {insights.budgetBurnRate && (
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Budget</h4>
          <p className="text-xs text-slate-600 mb-2">
            {insights.budgetBurnRate.assessment}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded p-2">
              <div className="text-sm font-bold text-slate-800">
                {insights.budgetBurnRate.estimatedTotalHours}h
              </div>
              <div className="text-[10px] text-slate-400">Est. Hours</div>
            </div>
            <div className="bg-slate-50 rounded p-2">
              <div className="text-sm font-bold text-slate-800">
                ${insights.budgetBurnRate.estimatedCost.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">Est. Cost</div>
            </div>
            {insights.budgetBurnRate.budgetRemaining != null && (
              <div className="bg-slate-50 rounded p-2">
                <div
                  className={`text-sm font-bold ${
                    insights.budgetBurnRate.budgetRemaining >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ${Math.abs(insights.budgetBurnRate.budgetRemaining).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">
                  {insights.budgetBurnRate.budgetRemaining >= 0
                    ? "Remaining"
                    : "Over Budget"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottlenecks */}
      {(insights.bottlenecks.overdueTasks.length > 0 ||
        insights.bottlenecks.unassignedTasks.length > 0 ||
        insights.bottlenecks.atRiskDeliverables.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-semibold text-amber-800 mb-2">
            Bottlenecks
          </h4>
          <p className="text-xs text-amber-700 mb-2">
            {insights.bottlenecks.assessment}
          </p>
          <div className="space-y-1.5">
            {insights.bottlenecks.overdueTasks.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                Overdue: {t}
              </div>
            ))}
            {insights.bottlenecks.atRiskDeliverables.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                At risk: {d}
              </div>
            ))}
            {insights.bottlenecks.overloadedMembers.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                Overloaded: {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h4 className="text-xs font-semibold text-slate-700 mb-3">
          Recommendations
        </h4>
        <div className="space-y-2">
          {insights.recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs"
            >
              <span
                className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                  rec.priority === "HIGH"
                    ? "bg-red-400"
                    : rec.priority === "MEDIUM"
                    ? "bg-amber-400"
                    : "bg-green-400"
                }`}
              />
              <span className="text-slate-600">{rec.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
