"use client";

import { useState } from "react";
import { differenceInDays } from "date-fns";
interface Milestone {
  id: string;
  name: string;
  dueDate: string | Date;
  completed: boolean;
}

interface MilestoneMarkersProps {
  milestones: Milestone[];
  viewStart: Date;
  dayWidth: number;
  chartHeight: number;
  totalWidth: number;
}

export function MilestoneMarkers({
  milestones,
  viewStart,
  dayWidth,
  chartHeight,
  totalWidth,
}: MilestoneMarkersProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (milestones.length === 0) return null;

  return (
    <>
      {milestones.map((milestone) => {
        const x = differenceInDays(new Date(milestone.dueDate), viewStart) * dayWidth;
        if (x < 0 || x > totalWidth) return null;

        const isCompleted = milestone.completed;
        const color = isCompleted ? "#cbd5e1" : "#a78bfa";

        return (
          <div key={milestone.id}>
            {/* Vertical dashed line */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: x,
                height: chartHeight,
                width: 0,
                borderLeft: `2px dashed ${color}`,
                opacity: 0.6,
                zIndex: 4,
              }}
            />
            {/* Diamond marker at top */}
            <div
              className="absolute cursor-pointer"
              style={{
                left: x - 8,
                top: 4,
                zIndex: 10,
              }}
              onMouseEnter={() => setHoveredId(milestone.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect
                  x="3"
                  y="3"
                  width="10"
                  height="10"
                  rx="1"
                  transform="rotate(45 8 8)"
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {isCompleted && (
                  <path
                    d="M5.5 8 L7 9.5 L10.5 6"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {/* Tooltip */}
              {hoveredId === milestone.id && (
                <div
                  className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-50"
                >
                  <div className="font-medium">{milestone.name}</div>
                  <div className="text-slate-300">
                    {new Date(milestone.dueDate).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
