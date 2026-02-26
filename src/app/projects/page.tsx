"use client";

import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { ProjectWizard } from "@/components/projects/wizard/ProjectWizard";
import { ProjectDetailDrawer } from "@/components/projects/ProjectDetailDrawer";
import { Button } from "@/components/ui/Button";
import type { Project, ProjectWithTasks } from "@/types";

export default function ProjectsPage() {
  const { projects, isLoading } = useProjects();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<ProjectWithTasks | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleCardClick = (project: ProjectWithTasks) => {
    setDetailProject(project);
    setDetailOpen(true);
  };

  const handleEditFromDrawer = () => {
    if (detailProject) {
      setEditProject(detailProject);
      setDetailOpen(false);
      setEditModalOpen(true);
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
    </div>
  );
}
