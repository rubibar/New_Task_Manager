"use client";

import { useState } from "react";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ScoreBadge } from "./ScoreBadge";
import {
  getStatusColor,
  getStatusLabel,
  getTypeColor,
  getTypeLabel,
  getPriorityLabel,
  formatDeadline,
} from "@/lib/utils";
import { changeTaskStatus, toggleEmergency, deleteTask } from "@/hooks/useTasks";
import type { TaskWithRelations } from "@/types";

interface TaskDetailDrawerProps {
  task: TaskWithRelations | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailDrawer({
  task,
  open,
  onClose,
}: TaskDetailDrawerProps) {
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  const handleStatusChange = async (status: string) => {
    setLoading(true);
    try {
      await changeTaskStatus(task.id, status);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyToggle = async () => {
    setLoading(true);
    try {
      await toggleEmergency(task.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteTask(task.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Task Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              {task.title}
            </h3>
            {task.project && (
              <span
                className="text-xs font-medium mt-1 inline-block"
                style={{ color: task.project.color }}
              >
                {task.project.name}
              </span>
            )}
          </div>
          <ScoreBadge score={task.displayScore} size="lg" />
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Description
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">
              {task.description}
            </p>
          </div>
        )}

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Status
            </h4>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(
                  task.status
                )}`}
              />
              <span className="text-sm text-slate-800">
                {getStatusLabel(task.status)}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Type
            </h4>
            <Badge className={getTypeColor(task.type)}>
              {getTypeLabel(task.type)}
            </Badge>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Priority
            </h4>
            <span className="text-sm text-slate-800">
              {getPriorityLabel(task.priority)}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Deadline
            </h4>
            <span className="text-sm text-slate-800">
              {formatDeadline(new Date(task.deadline))}
            </span>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Owner
            </h4>
            <div className="flex items-center gap-1.5">
              {task.owner.image ? (
                <img
                  src={task.owner.image}
                  alt={task.owner.name}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-300" />
              )}
              <span className="text-sm text-slate-800">{task.owner.name}</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
              Reviewer
            </h4>
            {task.reviewer ? (
              <div className="flex items-center gap-1.5">
                {task.reviewer.image ? (
                  <img
                    src={task.reviewer.image}
                    alt={task.reviewer.name}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-300" />
                )}
                <span className="text-sm text-slate-800">
                  {task.reviewer.name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-slate-400">None</span>
            )}
          </div>
        </div>

        {/* Score breakdown */}
        <div>
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Score Breakdown
          </h4>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono space-y-1">
            <p>Raw Score: {task.rawScore.toFixed(1)}</p>
            <p>Display Score: {task.displayScore.toFixed(0)}/100</p>
            {task.emergency && (
              <p className="text-red-600">+ Emergency Boost (+100)</p>
            )}
            {task.status === "IN_REVIEW" && (
              <p className="text-amber-600">+ Review Boost (+50)</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          {/* Status actions */}
          {task.status === "TODO" && (
            <Button
              onClick={() => handleStatusChange("IN_PROGRESS")}
              loading={loading}
              className="w-full"
            >
              Start Working
            </Button>
          )}
          {task.status === "IN_PROGRESS" && (
            <Button
              onClick={() => handleStatusChange("DONE")}
              loading={loading}
              className="w-full"
            >
              {task.reviewerId ? "Submit for Review" : "Mark as Done"}
            </Button>
          )}
          {task.status === "IN_REVIEW" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleStatusChange("APPROVED")}
                loading={loading}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleStatusChange("REQUEST_CHANGES")}
                loading={loading}
              >
                Request Changes
              </Button>
            </div>
          )}

          {/* Emergency toggle */}
          <Button
            variant={task.emergency ? "danger" : "ghost"}
            onClick={handleEmergencyToggle}
            loading={loading}
            className="w-full"
          >
            {task.emergency ? "Remove Emergency" : "Flag as Emergency"}
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            onClick={handleDelete}
            loading={loading}
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            Delete Task
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
