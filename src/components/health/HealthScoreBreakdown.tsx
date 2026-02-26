"use client";

import { useState } from "react";
import type { HealthScoreResult } from "@/types";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#f97316",
  F: "#ef4444",
};

function getBarColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  if (score >= 20) return "#f97316";
  return "#ef4444";
}

interface HealthScoreBreakdownProps {
  score: HealthScoreResult | null;
  loading?: boolean;
  onRecalculate?: () => void;
  recalculating?: boolean;
}

export function HealthScoreBreakdown({
  score,
  loading,
  onRecalculate,
  recalculating,
}: HealthScoreBreakdownProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 space-y-3 animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-32" />
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-3/4" />
      </div>
    );
  }

  if (!score) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 text-center">
        <p className="text-xs text-slate-400 mb-2">No health score calculated yet</p>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            disabled={recalculating}
            className="text-xs text-slate-600 hover:text-slate-800 underline"
          >
            {recalculating ? "Calculating..." : "Calculate Now"}
          </button>
        )}
      </div>
    );
  }

  const gradeColor = GRADE_COLORS[score.grade] || GRADE_COLORS.C;

  return (
    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
      {/* Header: overall score + grade */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: gradeColor }}
          >
            {score.grade}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-800">
              {Math.round(score.overall)}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </div>
            {score.trend !== 0 && (
              <span
                className={`text-[11px] font-medium ${
                  score.trend > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {score.trend > 0 ? "+" : ""}
                {Math.round(score.trend)} from last update
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              disabled={recalculating}
              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
              title="Recalculate"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={recalculating ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 11-2.2-5.9" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-slate-500 hover:text-slate-700 underline"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {/* Factor bars (always visible, compact) */}
      <div className="space-y-2">
        {score.factors.map((factor) => (
          <div key={factor.name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-slate-600">{factor.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(factor.score)}
                <span className="text-slate-300"> ({Math.round(factor.weight * 100)}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${factor.score}%`,
                  backgroundColor: getBarColor(factor.score),
                }}
              />
            </div>
            {/* Detail text shown when expanded */}
            {expanded && (
              <p className="text-[10px] text-slate-400 mt-0.5 pl-1">{factor.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
