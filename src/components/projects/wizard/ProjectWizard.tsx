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

export function ProjectWizard({ open, onClose }: ProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [step1Data, setStep1Data] = useState<Step1Data>(defaultStep1);
  const [step2Data, setStep2Data] = useState<Step2Data>(defaultStep2);
  const [step4Data, setStep4Data] = useState<Step4Data>(defaultStep4);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState("");

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

      // 3. Create tasks from selected templates
      const selectedTemplates = templates.filter((t) =>
        step2Data.selectedTemplateIds.includes(t.id)
      );
      for (const tmpl of selectedTemplates) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tmpl.name,
            type: tmpl.category === "ADMIN" ? "ADMIN" : "CLIENT",
            priority: tmpl.defaultPriority || "IMPORTANT_NOT_URGENT",
            ownerId: users?.[0]?.id,
            projectId: project.id,
            startDate: step1Data.startDate
              ? new Date(step1Data.startDate).toISOString()
              : new Date().toISOString(),
            deadline: step1Data.targetFinishDate
              ? new Date(step1Data.targetFinishDate).toISOString()
              : new Date().toISOString(),
          }),
        });
      }

      // 4. Create custom tasks
      const validCustomTasks = step2Data.customTasks.filter(
        (t) => t.name.trim()
      );
      for (const task of validCustomTasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.name.trim(),
            type: "CLIENT",
            priority: task.priority || "IMPORTANT_NOT_URGENT",
            ownerId: task.assigneeId || users?.[0]?.id,
            projectId: project.id,
            startDate: step1Data.startDate
              ? new Date(step1Data.startDate).toISOString()
              : new Date().toISOString(),
            deadline: task.dueDate
              ? new Date(task.dueDate).toISOString()
              : step1Data.targetFinishDate
              ? new Date(step1Data.targetFinishDate).toISOString()
              : new Date().toISOString(),
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
            <Step3AI step1Data={step1Data} step2Data={step2Data} />
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
