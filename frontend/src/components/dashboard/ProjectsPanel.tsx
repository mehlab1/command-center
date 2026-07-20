"use client";

import { useProjects } from "@/lib/queries";
import { StatusTag } from "@/components/StatusTag";

const STATUS_TO_TAG = {
  ACTIVE: "TODO",
  ON_HOLD: "BLOCKED",
  COMPLETED: "DONE",
  CANCELLED: "BLOCKED",
} as const;

export function ProjectsPanel() {
  const { data: projects, isLoading } = useProjects();

  return (
    <section>
      <h2 className="font-heading text-lg text-text mb-2">Projects</h2>
      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {projects?.length === 0 && (
        <p className="text-sm text-text-muted">No projects yet — tell the agent about your first one.</p>
      )}
      <div className="flex flex-col gap-2">
        {projects?.map((p) => (
          <div key={p.id} className="rounded-md border border-line bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text">{p.name}</p>
              <StatusTag kind={STATUS_TO_TAG[p.status]} />
            </div>
            {p.category && <p className="text-xs text-text-muted mt-0.5">{p.category}</p>}
            <div className="flex gap-3 mt-1.5 text-xs">
              {p.taskCount === 0 ? (
                <span className="text-blocked">⚠ no tasks yet</span>
              ) : p.assignedTaskCount === 0 ? (
                <span className="text-blocked">⚠ {p.taskCount} task(s), none assigned to a dev</span>
              ) : (
                <span className="text-text-muted">
                  {p.assignedTaskCount}/{p.taskCount} task(s) assigned
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
