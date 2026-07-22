"use client";

import { useState } from "react";
import { useProjects } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";
import { CreateProjectModal } from "@/components/CreateProjectModal";
import { ProjectDTO } from "@/lib/types";

const STATUS_TO_TAG = {
  ACTIVE: "TODO",
  ON_HOLD: "BLOCKED",
  COMPLETED: "DONE",
  CANCELLED: "BLOCKED",
} as const;

function ProjectRow({ project }: { project: ProjectDTO }) {
  // Only an ACTIVE project with no tasks (or no dev on any of them) is a
  // real gap worth glowing over — a completed/on-hold/cancelled project
  // with zero tasks isn't something that needs chasing.
  const needsAttention = project.status === "ACTIVE" && (project.taskCount === 0 || project.assignedTaskCount === 0);

  return (
    <a
      href={`/projects/${project.id}`}
      className={`block rounded-md border bg-paper p-3 flex flex-col gap-1.5 ${needsAttention ? "alert-glow" : "border-line"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">{project.name}</p>
        <StatusTag kind={STATUS_TO_TAG[project.status]} />
      </div>
      {project.category && <p className="text-xs text-text-muted">{project.category}</p>}
      <p className={`text-xs ${needsAttention ? "text-blocked font-medium" : "text-text-muted"}`}>
        {project.taskCount === 0
          ? "No tasks yet"
          : project.assignedTaskCount === 0
            ? `${project.taskCount} task(s), none assigned to a dev`
            : `${project.assignedTaskCount}/${project.taskCount} task(s) assigned`}
      </p>
    </a>
  );
}

export default function ProjectsPage() {
  const projectsQuery = useProjects();
  const waking = useColdStartBanner([projectsQuery]);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-heading text-xl text-text">Projects</h1>
        <button
          onClick={() => setCreating(true)}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast px-3 py-1.5 text-xs font-semibold"
        >
          + Add project
        </button>
      </div>

      {waking && <p role="status" className="text-sm text-text-muted mb-2">Waking things up — just a few more seconds.</p>}
      {projectsQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {projectsQuery.data?.length === 0 && (
        <p className="text-sm text-text-muted">No projects yet — add one to get started.</p>
      )}

      <div className="flex flex-col gap-2">
        {projectsQuery.data?.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </div>

      {creating && <CreateProjectModal onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}
