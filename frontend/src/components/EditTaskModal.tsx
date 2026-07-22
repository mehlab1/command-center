"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { apiFetch } from "@/lib/api";
import { useDevs, useProjects } from "@/lib/queries";
import { TaskDTO } from "@/lib/types";

interface EditTaskModalProps {
  task: TaskDTO;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";
const labelClass = "text-xs text-text-muted";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// A true in-place edit — PATCHes the same task id, so QA state, ratings, and
// any blocked/missed-deadline history on it survive untouched. Reassigning
// devs or moving projects reuses the same chip-picker/dropdown UI as
// CreateTaskModal rather than free-text, so it's always a pick from what
// already exists.
export function EditTaskModal({ task, onClose, onSaved }: EditTaskModalProps) {
  const devsQuery = useDevs();
  const projectsQuery = useProjects();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [projectId, setProjectId] = useState(task.project?.id ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees.map((a) => a.dev.id));
  const [deadline, setDeadline] = useState(toDatetimeLocal(task.deadline));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) return setError("Give the task a title.");
    if (!deadline) return setError("Set a deadline.");
    if (!task.isPersonal && assigneeIds.length === 0) return setError("Assign at least one dev.");

    setBusy(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          notes: notes.trim() || null,
          projectId: projectId || null,
          deadline: new Date(deadline).toISOString(),
          ...(task.isPersonal ? {} : { assigneeDevIds: assigneeIds }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't save those changes.");
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit task" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Description (optional)</span>
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Notes (optional)</span>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Project (optional)</span>
          <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No project</option>
            {projectsQuery.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {!task.isPersonal && (
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Assignees (up to 2)</span>
            <div className="flex flex-wrap gap-2">
              {devsQuery.data?.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleAssignee(d.id)}
                  className={`rounded-sm border px-2 py-1 text-xs ${
                    assigneeIds.includes(d.id) ? "border-signal bg-signal text-signal-contrast" : "border-line text-text-muted"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Deadline</span>
          <input type="datetime-local" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>

        {error && <p className="text-xs text-blocked">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
