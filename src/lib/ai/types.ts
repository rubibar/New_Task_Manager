// 1C — Per-Project AI Insight Panel
export interface ProjectInsightResponse {
  progressAnalysis: {
    overallPercent: number;
    taskBreakdown: { done: number; inProgress: number; todo: number; total: number };
    deliverableBreakdown: { completed: number; total: number };
    assessment: string;
  };
  budgetBurnRate: {
    estimatedTotalHours: number;
    estimatedCost: number;
    budgetRemaining: number | null;
    projectedOvershoot: number | null;
    assessment: string;
  } | null;
  bottlenecks: {
    overdueTasks: string[];
    unassignedTasks: string[];
    atRiskDeliverables: string[];
    overloadedMembers: string[];
    assessment: string;
  };
  timelineRisk: {
    level: "LOW" | "MEDIUM" | "HIGH";
    explanation: string;
  };
  recommendations: {
    text: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }[];
}

// 1A — Project Creation Wizard AI Insight
export interface WizardInsightResponse {
  projectSummary: string;
  riskFlags: {
    flag: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
  }[];
  suggestedMilestones: {
    name: string;
    suggestedDate: string;
    reasoning: string;
  }[];
  benchmarks: {
    available: boolean;
    comparisons: {
      projectName: string;
      duration: number;
      taskCount: number;
      budget: number | null;
    }[];
  } | null;
  suggestedTasks: {
    name: string;
    category: string;
    estimatedHours: number;
    reasoning: string;
    suggestedStartDate?: string;
    suggestedDeadline?: string;
  }[];
  hoursEstimate: {
    totalHours: number;
    breakdown: { category: string; hours: number }[];
    assumptions: string;
  };
  teamAllocation: {
    memberId: string;
    memberName: string;
    suggestedTasks: string[];
    reasoning: string;
  }[];
}

// 1D — Global Dashboard AI Insight
export interface GlobalInsightResponse {
  workloadAssessment: string;
  atRiskProjects: {
    projectName: string;
    riskLevel: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  }[];
  deadlineClusters: {
    dateRange: string;
    items: string[];
    warning: string;
  }[];
  budgetHealth: string;
  weeklyPriorityActions: {
    action: string;
    project: string;
    urgency: "HIGH" | "MEDIUM" | "LOW";
  }[];
}
