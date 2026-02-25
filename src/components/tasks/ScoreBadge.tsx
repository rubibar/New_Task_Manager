"use client";

import { motion } from "framer-motion";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getScoreColor(score: number) {
  if (score >= 70) return { bg: "bg-red-500", text: "text-white" };
  if (score >= 40) return { bg: "bg-amber-500", text: "text-white" };
  return { bg: "bg-slate-400", text: "text-white" };
}

const sizes = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
};

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const colors = getScoreColor(score);
  const rounded = Math.round(score);

  return (
    <motion.div
      key={rounded}
      initial={{ scale: 1.2 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        ${sizes[size]} ${colors.bg} ${colors.text}
        rounded-full flex items-center justify-center
        font-bold tabular-nums flex-shrink-0
      `}
      title={`Score: ${rounded}`}
    >
      {rounded}
    </motion.div>
  );
}
