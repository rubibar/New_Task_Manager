"use client";

import { useState } from "react";
import { useProjects, deleteProject } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { ProjectWizard } from "@/components/projects/wizard/ProjectWizard";
import { ProjectDetailDrawer } from "@/components/projects/ProjectDetailDrawer";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Project, ProjectWithTasks } from "@/types";

export default function ProjectsPage() {
  const { projects, isLoading } = useProjects();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectWithTasks | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithTasks | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleCardClick = (project: ProjectWithTasks) => {
    setDetailProject(project);
    setDetailOpen(true);
  };

  const handleEdit = (project: ProjectWithTasks) => {
    setEditProject(project);
    setEditModalOpen(true);
  };

  const handleEditFromDrawer = () => {
    if (detailProject) {
      setEditProject(detailProject);
      setDetailOpen(false);
      setEditModalOpen(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete project"
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setDetailProject(null);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setEditProject(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-100 p-5 animate-pulse"
            >
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-full mb-4" />
              <div className="h-2 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Projects</h1>
        <Button onClick={() => setWizardOpen(true)}>+ New Project</Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm mb-3">
            No projects yet. Create one to organize your tasks.
          </p>
          <Button onClick={() => setWizardOpen(true)} size="sm">
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleCardClick(project)}
              onEdit={() => handleEdit(project)}
              onDelete={() => {
                setDeleteError("");
                setDeleteTarget(project);
              }}
            />
          ))}
        </div>
      )}

      <ProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      <ProjectDetailDrawer
        open={detailOpen}
        onClose={handleCloseDetail}
        project={detailProject}
        onEdit={handleEditFromDrawer}
      />

      <ProjectModal
        open={editModalOpen}
        onClose={handleCloseEdit}
        project={editProject}
      />

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-slate-800">
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          {deleteTarget && deleteTarget.tasks.filter((t) => t.status !== "DONE").length > 0 && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg">
              This project has{" "}
              {deleteTarget.tasks.filter((t) => t.status !== "DONE").length}{" "}
              active task(s). You must complete or remove them before deleting.
            </div>
          )}
          {deleteError && (
            <div className="text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDelete}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
