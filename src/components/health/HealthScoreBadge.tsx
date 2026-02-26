"use client";

import type { HealthScoreResult } from "@/types";

const GRADE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: "bg-green-100", text: "text-green-700", ring: "ring-green-200" },
  B: { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-200" },
  C: { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-200" },
  D: { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200" },
  F: { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-200" },
};

interface HealthScoreBadgeProps {
  score: HealthScoreResult | null;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
}

export function HealthScoreBadge({
  score,
  loading,
  size = "md",
  showTrend = false,
}: HealthScoreBadgeProps) {
  if (loading) {
    const dims = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-12 h-12" : "w-9 h-9";
    return <div className={`${dims} rounded-full bg-slate-100 animate-pulse`} />;
  }

  if (!score) return null;

  const style = GRADE_STYLES[score.grade] || GRADE_STYLES.C;
  const sizeClasses =
    size === "sm"
      ? "w-7 h-7 text-[10px]"
      : size === "lg"
      ? "w-12 h-12 text-base"
      : "w-9 h-9 text-xs";

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${sizeClasses} ${style.bg} ${style.text} ring-1 ${style.ring} rounded-full flex items-center justify-center font-bold shrink-0`}
        title={`Health: ${score.overall}/100 (${score.grade})`}
      >
        {score.grade}
      </div>
      {showTrend && score.trend !== 0 && (
        <span
          className={`text-[10px] font-medium ${
            score.trend > 0 ? "text-green-600" : "text-red-500"
          }`}
        >
          {score.trend > 0 ? "+" : ""}
          {Math.round(score.trend)}
        </span>
      )}
    </div>
  );
}
