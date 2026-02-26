"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "./StepIndicator";
import { Step1Details, type Step1Data } from "./Step1Details";
import { Step2Deliverables, type Step2Data } from "./Step2Deliverables";
import { Step3AI } from "./Step3AI";
import { Step4Folders, type Step4Data } from "./Step4Folders";
import { Step5Review } from "./Step5Review";
import { useProjectTypes } from "@/hooks/useProjectTypes";
import { useTaskTemplates } from "@/hooks/useTaskTemplates";
import { useClientNames } from "@/hooks/useClientNames";
import { createProject } from "@/hooks/useProjects";
import type { UserWithCapacity } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface ProjectWizardProps {
  open: boolean;
  onClose: () => void;
}

const defaultStep1: Step1Data = {
  name: "",
  clientName: "",
  description: "",
  projectTypeId: "",
  startDate: "",
  targetFinishDate: "",
  budget: "",
  shiftRate: "",
  hourlyRate: "",
  status: "NOT_STARTED",
  color: "#C8FF00",
};

const defaultStep2: Step2Data = {
  deliverables: [],
  selectedTemplateIds: [],
  customTasks: [],
};

const defaultStep4: Step4Data = {
  folderStructure: null,
  basePath: "",
};

// Category ordering for timeline distribution
const CATEGORY_ORDER: Record<string, number> = {
  ADMIN_EARLY: 0,      // Contract/SOW type admin
  PRE_PRODUCTION: 1,
  PRODUCTION: 2,
  POST_PRODUCTION: 3,
  ADMIN_LATE: 4,        // Invoice/archival type admin
};

// Admin tasks that belong early in the timeline
const EARLY_ADMIN_KEYWORDS = ["contract", "sow", "brief", "kickoff", "scope"];

function computeTaskDates(
  tasks: { name: string; category: string; estimatedHours?: number }[],
  projectStart: string,
  projectEnd: string
): { startDate: string; deadline: string }[] {
  const start = new Date(projectStart).getTime();
  const end = new Date(projectEnd).getTime();
  const totalDuration = end - start;

  if (tasks.length === 0 || totalDuration <= 0) {
    return tasks.map(() => ({ startDate: projectStart, deadline: projectEnd }));
  }

  // Assign a phase to each task
  const tasksWithPhase = tasks.map((t) => {
    let phase = CATEGORY_ORDER[t.category] ?? 2;
    // Split ADMIN into early/late based on task name
    if (t.category === "ADMIN") {
      const nameLower = t.name.toLowerCase();
      const isEarly = EARLY_ADMIN_KEYWORDS.some((kw) => nameLower.includes(kw));
      phase = isEarly ? 0 : 4;
    }
    return { ...t, phase };
  });

  // Group by phase, then sort phases
  const phases = new Map<number, typeof tasksWithPhase>();
  for (const t of tasksWithPhase) {
    if (!phases.has(t.phase)) phases.set(t.phase, []);
    phases.get(t.phase)!.push(t);
  }
  const sortedPhaseKeys = Array.from(phases.keys()).sort((a, b) => a - b);
  const phaseCount = sortedPhaseKeys.length;

  // Allocate timeline proportions: each phase gets a segment
  // with slight overlap between phases (10% overlap)
  const results: { startDate: string; deadline: string }[] = new Array(tasks.length);
  const overlapFraction = 0.1;

  sortedPhaseKeys.forEach((phaseKey, phaseIdx) => {
    const phaseTasks = phases.get(phaseKey)!;
    const phaseStart = (phaseIdx / phaseCount);
    const phaseEnd = ((phaseIdx + 1) / phaseCount);
    // Extend slightly for overlap (except first/last)
    const adjustedStart = phaseIdx > 0 ? phaseStart - overlapFraction / phaseCount : phaseStart;
    const adjustedEnd = phaseIdx < phaseCount - 1 ? phaseEnd + overlapFraction / phaseCount : phaseEnd;

    // Within the phase, distribute tasks sequentially
    const taskCount = phaseTasks.length;
    phaseTasks.forEach((task, taskIdx) => {
      // Find original index in the input array
      const origIdx = tasksWithPhase.indexOf(task);

      const taskFractionStart = adjustedStart + (taskIdx / taskCount) * (adjustedEnd - adjustedStart);
      const taskFractionEnd = adjustedStart + ((taskIdx + 1) / taskCount) * (adjustedEnd - adjustedStart);

      const taskStartMs = start + taskFractionStart * totalDuration;
      const taskEndMs = start + taskFractionEnd * totalDuration;

      // Ensure minimum 1 day duration
      const finalEnd = Math.max(taskEndMs, taskStartMs + 86400000);

      results[origIdx] = {
        startDate: new Date(taskStartMs).toISOString().split("T")[0],
        deadline: new Date(Math.min(finalEnd, end)).toISOString().split("T")[0],
      };
    });
  });

  return results;
}

export function ProjectWizard({ open, onClose }: ProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [step1Data, setStep1Data] = useState<Step1Data>(defaultStep1);
  const [step2Data, setStep2Data] = useState<Step2Data>(defaultStep2);
  const [step4Data, setStep4Data] = useState<Step4Data>(defaultStep4);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [acceptedMilestones, setAcceptedMilestones] = useState<{ name: string; dueDate: string }[]>([]);
  const [acceptedAITasks, setAcceptedAITasks] = useState<{ name: string; startDate: string; deadline: string }[]>([]);

  const { projectTypes } = useProjectTypes();
  const { templates } = useTaskTemplates();
  const { clientNames } = useClientNames();
  const { data: users } = useSWR<UserWithCapacity[]>("/api/users", fetcher);

  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setStep1Data(defaultStep1);
    setStep2Data(defaultStep2);
    setStep4Data(defaultStep4);
    setErrors({});
    setCreateError("");
    setAcceptedMilestones([]);
    setAcceptedAITasks([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!step1Data.name.trim()) newErrors.name = "Project name is required";
    if (!step1Data.clientName.trim())
      newErrors.clientName = "Client name is required";
    if (!step1Data.startDate) newErrors.startDate = "Start date is required";
    if (!step1Data.targetFinishDate)
      newErrors.targetFinishDate = "Target finish date is required";
    if (
      step1Data.startDate &&
      step1Data.targetFinishDate &&
      new Date(step1Data.targetFinishDate) < new Date(step1Data.startDate)
    ) {
      newErrors.targetFinishDate = "Must be after start date";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
    }
    setCompletedSteps((prev) => {
      const next = new Set(Array.from(prev));
      next.add(currentStep);
      return next;
    });
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreate = async () => {
    setLoading(true);
    setCreateError("");

    try {
      // 1. Create the project
      const project = await createProject({
        name: step1Data.name.trim(),
        clientName: step1Data.clientName.trim() || undefined,
        description: step1Data.description.trim() || undefined,
        projectTypeId: step1Data.projectTypeId || undefined,
        startDate: step1Data.startDate || undefined,
        targetFinishDate: step1Data.targetFinishDate || undefined,
        budget: step1Data.budget ? Number(step1Data.budget) : undefined,
        shiftRate: step1Data.shiftRate ? Number(step1Data.shiftRate) : undefined,
        hourlyRate: step1Data.hourlyRate
          ? Number(step1Data.hourlyRate)
          : undefined,
        status: step1Data.status as "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD",
        color: step1Data.color,
      });

      // 2. Create deliverables
      const validDeliverables = step2Data.deliverables.filter(
        (d) => d.name.trim()
      );
      for (const del of validDeliverables) {
        await fetch("/api/deliverables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            name: del.name.trim(),
            description: del.description.trim() || undefined,
            dueDate: del.dueDate || step1Data.targetFinishDate,
            assigneeId: del.assigneeId || undefined,
          }),
        });
      }

      // 3. Create tasks from selected templates — with smart date distribution
      const selectedTemplates = templates.filter((t) =>
        step2Data.selectedTemplateIds.includes(t.id)
      );

      const projStart = step1Data.startDate || new Date().toISOString().split("T")[0];
      const projEnd = step1Data.targetFinishDate || projStart;

      // Compute distributed dates for template tasks
      const templateDates = computeTaskDates(
        selectedTemplates.map((t) => ({
          name: t.name,
          category: t.category,
          estimatedHours: t.estimatedHours ?? undefined,
        })),
        projStart,
        projEnd
      );

      for (let i = 0; i < selectedTemplates.length; i++) {
        const tmpl = selectedTemplates[i];
        const dates = templateDates[i];
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tmpl.name,
            type: tmpl.category === "ADMIN" ? "ADMIN" : "CLIENT",
            priority: tmpl.defaultPriority || "IMPORTANT_NOT_URGENT",
            ownerId: users?.[0]?.id,
            projectId: project.id,
            startDate: new Date(dates.startDate).toISOString(),
            deadline: new Date(dates.deadline).toISOString(),
          }),
        });
      }

      // 4. Create custom tasks — use user-provided dates or distribute
      const validCustomTasks = step2Data.customTasks.filter(
        (t) => t.name.trim()
      );

      // Custom tasks without explicit dates get distributed
      const customTasksForDistribution = validCustomTasks
        .filter((t) => !t.dueDate)
        .map((t) => ({ name: t.name, category: t.category || "PRODUCTION" }));
      const customDates = computeTaskDates(customTasksForDistribution, projStart, projEnd);

      let distIdx = 0;
      for (const task of validCustomTasks) {
        let taskStart: string;
        let taskEnd: string;

        if (task.dueDate) {
          // User specified a date — use it, start a few days before
          taskEnd = task.dueDate;
          const endMs = new Date(task.dueDate).getTime();
          const startMs = Math.max(new Date(projStart).getTime(), endMs - 3 * 86400000);
          taskStart = new Date(startMs).toISOString().split("T")[0];
        } else {
          const dates = customDates[distIdx++];
          taskStart = dates.startDate;
          taskEnd = dates.deadline;
        }

        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.name.trim(),
            type: "CLIENT",
            priority: task.priority || "IMPORTANT_NOT_URGENT",
            ownerId: task.assigneeId || users?.[0]?.id,
            projectId: project.id,
            startDate: new Date(taskStart).toISOString(),
            deadline: new Date(taskEnd).toISOString(),
          }),
        });
      }

      // 5. Create accepted AI-suggested tasks — use AI-provided dates when available
      for (const aiTask of acceptedAITasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: aiTask.name,
            type: "CLIENT",
            priority: "IMPORTANT_NOT_URGENT",
            ownerId: users?.[0]?.id,
            projectId: project.id,
            startDate: new Date(aiTask.startDate || projStart).toISOString(),
            deadline: new Date(aiTask.deadline || projEnd).toISOString(),
          }),
        });
      }

      // 6. Create accepted milestones
      for (const ms of acceptedMilestones) {
        await fetch("/api/milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            name: ms.name,
            dueDate: ms.dueDate,
          }),
        });
      }

      handleClose();
    } catch {
      setCreateError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New Project"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          onStepClick={goToStep}
          completedSteps={completedSteps}
        />

        {/* Error */}
        {createError && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {createError}
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 1 && (
            <Step1Details
              data={step1Data}
              onChange={setStep1Data}
              projectTypes={projectTypes}
              clientNames={clientNames}
              errors={errors}
            />
          )}
          {currentStep === 2 && (
            <Step2Deliverables
              data={step2Data}
              onChange={setStep2Data}
              templates={templates}
              users={users || []}
            />
          )}
          {currentStep === 3 && (
            <Step3AI
              step1Data={step1Data}
              step2Data={step2Data}
              projectTypes={projectTypes}
              templates={templates}
              users={users || []}
              onAcceptMilestones={setAcceptedMilestones}
              onAcceptTasks={setAcceptedAITasks}
            />
          )}
          {currentStep === 4 && (
            <Step4Folders
              data={step4Data}
              onChange={setStep4Data}
              projectName={step1Data.name}
              clientName={step1Data.clientName}
            />
          )}
          {currentStep === 5 && (
            <Step5Review
              step1Data={step1Data}
              step2Data={step2Data}
              step4Data={step4Data}
              projectTypes={projectTypes}
              templates={templates}
              users={users || []}
              onJumpToStep={goToStep}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            {currentStep > 1 && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            {currentStep < 5 ? (
              <Button onClick={handleNext}>
                {currentStep === 1 ? "Next" : "Continue"}
              </Button>
            ) : (
              <Button onClick={handleCreate} loading={loading}>
                Create Project
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
