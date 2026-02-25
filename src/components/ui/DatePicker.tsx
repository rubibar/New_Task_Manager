"use client";

import { type InputHTMLAttributes } from "react";

interface DatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function DatePicker({ label, className = "", ...props }: DatePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <input
        type="datetime-local"
        className={`
          w-full px-3 py-2 rounded-lg border border-slate-200
          bg-white text-sm text-slate-800
          focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
