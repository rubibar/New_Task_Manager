"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/Button";

interface FocusBriefing {
  greeting: string;
  topPriorities: string[];
  deadlineWarnings: string[];
  suggestion: string;
}

interface TodaysFocusProps {
  userName: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    deadline: string | Date;
    displayScore: number;
    emergency: boolean;
    project?: { name: string } | null;
    owner: { name: string };
  }[];
}

export function TodaysFocus({ userName, tasks }: TodaysFocusProps) {
  const [briefing, setBriefing] = useState<FocusBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateBriefing = () => {
    // Generate briefing client-side from task data (no AI call needed)
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
    const firstName = userName?.split(" ")[0] || "there";

    const activeTasks = tasks.filter((t) => t.status !== "DONE");
    const overdueTasks = activeTasks.filter(
      (t) => new Date(t.deadline) < now
    );
    const dueTodayTasks = activeTasks.filter(
      (t) => new Date(t.deadline).toISOString().split("T")[0] === today
    );
    const dueTomorrowTasks = activeTasks.filter(
      (t) => new Date(t.deadline).toISOString().split("T")[0] === tomorrow
    );
    const emergencyTasks = activeTasks.filter((t) => t.emergency);
    const topTasks = activeTasks
      .sort((a, b) => b.displayScore - a.displayScore)
      .slice(0, 3);

    // Build greeting based on time of day
    const hour = now.getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17) timeGreeting = "Good evening";

    let greeting = `${timeGreeting}, ${firstName}!`;
    if (emergencyTasks.length > 0) {
      greeting += ` You have ${emergencyTasks.length} emergency task${emergencyTasks.length > 1 ? "s" : ""} that need immediate attention.`;
    } else if (overdueTasks.length > 0) {
      greeting += ` You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} to address.`;
    } else if (dueTodayTasks.length > 0) {
      greeting += ` ${dueTodayTasks.length} task${dueTodayTasks.length > 1 ? "s" : ""} due today.`;
    } else {
      greeting += ` ${activeTasks.length} active tasks on your plate.`;
    }

    const topPriorities = topTasks.map(
      (t) => `${t.title}${t.project ? ` (${t.project.name})` : ""}`
    );

    const deadlineWarnings: string[] = [];
    if (overdueTasks.length > 0) {
      deadlineWarnings.push(
        `${overdueTasks.length} task${overdueTasks.length > 1 ? "s are" : " is"} overdue`
      );
    }
    if (dueTodayTasks.length > 0) {
      deadlineWarnings.push(
        `${dueTodayTasks.length} due today: ${dueTodayTasks.map((t) => t.title).join(", ")}`
      );
    }
    if (dueTomorrowTasks.length > 0) {
      deadlineWarnings.push(
        `${dueTomorrowTasks.length} due tomorrow`
      );
    }

    let suggestion = "Focus on your highest-scored task first.";
    if (emergencyTasks.length > 0) {
      suggestion = `Handle emergency task "${emergencyTasks[0].title}" first, then move to your top priority.`;
    } else if (overdueTasks.length > 0) {
      suggestion = `Clear overdue items first: "${overdueTasks[0].title}" needs attention.`;
    } else if (topTasks.length > 0) {
      suggestion = `Start with "${topTasks[0].title}" — it has the highest priority score.`;
    }

    setBriefing({ greeting, topPriorities, deadlineWarnings, suggestion });
  };

  useEffect(() => {
    if (tasks.length > 0 && !briefing) {
      generateBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const fetchAIInsight = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/global-insights", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAiInsight(data.workloadAssessment || "No insight available.");
    } catch {
      setError("Could not load AI insight.");
    } finally {
      setLoading(false);
    }
  };

  if (!briefing) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#C8FF00]">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-800">Today&apos;s Focus</h3>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">{briefing.greeting}</p>

          {briefing.deadlineWarnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {briefing.deadlineWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
                  </svg>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {briefing.topPriorities.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Top Priorities</p>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-0.5">
                {briefing.topPriorities.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-3 px-3 py-2 bg-[#C8FF00]/10 rounded-lg">
            <p className="text-xs text-slate-700">
              <span className="font-medium">Suggestion:</span> {briefing.suggestion}
            </p>
          </div>

          {/* AI insight section */}
          {aiInsight && (
            <div className="mt-3 px-3 py-2 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-800">
                <span className="font-medium">AI Studio Insight:</span> {aiInsight}
              </p>
            </div>
          )}
          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={fetchAIInsight}
          loading={loading}
          className="text-xs"
        >
          Get AI Studio Insight
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={generateBriefing}
          className="text-xs"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
