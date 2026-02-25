"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { DatePicker } from "../ui/DatePicker";
import { createTask } from "@/hooks/useTasks";
import type { TaskType, Priority } from "@/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
}

const taskTypes = [
  { value: "CLIENT", label: "Client" },
  { value: "INTERNAL_RD", label: "R&D" },
  { value: "ADMIN", label: "Admin" },
];

const priorities = [
  { value: "URGENT_IMPORTANT", label: "Urgent & Important" },
  { value: "IMPORTANT_NOT_URGENT", label: "Important (Not Urgent)" },
  { value: "URGENT_NOT_IMPORTANT", label: "Urgent (Not Important)" },
  { value: "NEITHER", label: "Low Priority" },
];

export function CreateTaskModal({ open, onClose }: CreateTaskModalProps) {
  const { data: session } = useSession();
  const { data: users } = useSWR("/api/users", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);

  const userId = (session as unknown as Record<string, unknown>)?.userId as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("CLIENT");
  const [priority, setPriority] = useState<Priority>("IMPORTANT_NOT_URGENT");
  const [ownerId, setOwnerId] = useState(userId || "");
  const [reviewerId, setReviewerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !ownerId || !startDate || !deadline) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createTask({
        title,
        description: description || undefined,
        type,
        priority,
        ownerId,
        reviewerId: reviewerId || undefined,
        projectId: projectId || undefined,
        startDate,
        deadline,
        emergency,
      });
      // Reset form
      setTitle("");
      setDescription("");
      setType("CLIENT");
      setPriority("IMPORTANT_NOT_URGENT");
      setReviewerId("");
      setProjectId("");
      setStartDate("");
      setDeadline("");
      setEmergency(false);
      onClose();
    } catch {
      setError("Failed to create task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const userOptions = (users || []).map((u: { id: string; name: string }) => ({
    value: u.id,
    label: u.name,
  }));

  const projectOptions = [
    { value: "", label: "No project" },
    ...(projects || []).map((p: { id: string; name: string }) => ({
      value: p.id,
      label: p.name,
    })),
  ];

  const reviewerOptions = [
    { value: "", label: "No reviewer" },
    ...userOptions.filter((u: { value: string }) => u.value !== ownerId),
  ];

  return (
    <Modal open={open} onClose={onClose} title="Create Task" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add details..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:border-transparent resize-none"
          />
        </div>

        {/* Type + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type *"
            options={taskTypes}
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
          />
          <Select
            label="Priority *"
            options={priorities}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
        </div>

        {/* Owner + Reviewer row */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Owner *"
            options={userOptions}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          />
          <Select
            label="Reviewer"
            options={reviewerOptions}
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
          />
        </div>

        {/* Project */}
        <Select
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        />

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-4">
          <DatePicker
            label="Start Date *"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <DatePicker
            label="Deadline *"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        {/* Emergency toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={emergency}
            onChange={(e) => setEmergency(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500"
          />
          <span className="text-sm text-red-600 font-medium">
            Emergency Task
          </span>
        </label>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
