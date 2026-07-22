"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useProjects, useTasks } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";
import { apiFetch } from "@/lib/api";
import { formatDeadline } from "@/lib/dateFormat";
import { ProjectStatus } from "@/lib/types";

const STATUS_TO_TAG = {
  ACTIVE: "TODO",
  ON_HOLD: "BLOCKED",
  COMPLETED: "DONE",
  CANCELLED: "BLOCKED",
} as const;

const inputClass =
  "rounded-sm border border-line bg-ink px-2 py-1.5 text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-signal";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectsQuery = useProjects();
  const tasksQuery = useTasks();
  const waking = useColdStartBanner([projectsQuery, tasksQuery]);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [cascadeTasks, setCascadeTasks] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const project = projectsQuery.data?.find((p) => p.id === params.id);
  const projectTasks = tasksQuery.data?.filter((t) => t.project?.id === params.id) ?? [];

  async function handleStatusChange(status: ProjectStatus) {
    setStatusBusy(true);
    try {
      const res = await apiFetch(`/api/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) queryClient.invalidateQueries({ queryKey: ["projects"] });
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/api/projects/${params.id}?cascadeTasks=${cascadeTasks}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.push("/projects");
    } catch {
      setDeleteBusy(false);
      setDeleteConfirming(false);
    }
  }

  if (waking) {
    return <p role="status" className="p-4 text-sm text-text-muted">Waking things up — just a few more seconds.</p>;
  }
  if (projectsQuery.isLoading) {
    return <p className="p-4 text-sm text-text-muted">Loading…</p>;
  }
  if (!project) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">Project not found.</p>
        <a href="/projects" className="text-sm text-signal underline">Back to projects</a>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <a href="/projects" className="text-xs text-text-muted font-heading">‹ PROJECTS</a>

      <div className="flex items-start justify-between gap-2">
        <h1 className="font-heading text-xl text-text">{project.name}</h1>
        <StatusTag kind={STATUS_TO_TAG[project.status]} />
      </div>

      <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-2 text-sm">
        {project.category && (
          <div className="flex justify-between">
            <span className="text-text-muted">Category</span>
            <span className="text-text">{project.category}</span>
          </div>
        )}
        {project.deadline && (
          <div className="flex justify-between">
            <span className="text-text-muted">Deadline</span>
            <span className="text-text">{formatDeadline(project.deadline)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Status</span>
          <select
            className={inputClass}
            value={project.status}
            disabled={statusBusy}
            onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {project.description && (
        <div>
          <p className="text-xs text-text-muted mb-1">Description</p>
          <p className="text-sm text-text">{project.description}</p>
        </div>
      )}

      <div>
        <p className="text-xs text-text-muted mb-2">Tasks ({projectTasks.length})</p>
        {projectTasks.length === 0 && <p className="text-sm text-text-muted">No tasks in this project yet.</p>}
        <div className="flex flex-col gap-2">
          {projectTasks.map((t) => (
            <a key={t.id} href={`/tasks/${t.id}`} className="block rounded-md border border-line bg-paper p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text">{t.title}</p>
                <StatusTag kind={t.status} />
              </div>
              <p className="text-xs text-text-muted mt-1">due {formatDeadline(t.deadline)}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4">
        {!deleteConfirming ? (
          <button onClick={() => setDeleteConfirming(true)} className="text-xs text-blocked underline">
            Delete this project
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-blocked p-3">
            {projectTasks.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-text">
                <input type="checkbox" checked={cascadeTasks} onChange={(e) => setCascadeTasks(e.target.checked)} />
                Also delete its {projectTasks.length} task(s)
              </label>
            )}
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} disabled={deleteBusy} className="text-xs text-blocked font-semibold">
                {deleteBusy ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setDeleteConfirming(false)} className="text-xs text-text-muted">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
