"use client";

const STEPS = [
  { number: 1, label: "Details" },
  { number: 2, label: "Deliverables & Tasks" },
  { number: 3, label: "AI Insights" },
  { number: 4, label: "Folder Structure" },
  { number: 5, label: "Review" },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}

export function StepIndicator({
  currentStep,
  onStepClick,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((step, i) => {
        const isActive = step.number === currentStep;
        const isCompleted = completedSteps.has(step.number);
        const isClickable = isCompleted || step.number <= currentStep;

        return (
          <div key={step.number} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.number)}
              disabled={!isClickable}
              className={`flex items-center gap-2 w-full group ${
                isClickable ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  isActive
                    ? "bg-[#C8FF00] text-slate-900"
                    : isCompleted
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isCompleted && !isActive ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block truncate ${
                  isActive
                    ? "text-slate-800"
                    : isCompleted
                    ? "text-slate-600"
                    : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 min-w-4 mx-2 ${
                  isCompleted ? "bg-slate-800" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
