"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { apiFetch } from "@/lib/api";
import { useDevs, useProjects } from "@/lib/queries";

interface CreateTaskModalProps {
  onClose: () => void;
  onCreated: () => void;
  defaultProjectId?: string;
}

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";
const labelClass = "text-xs text-text-muted";

export function CreateTaskModal({ onClose, onCreated, defaultProjectId }: CreateTaskModalProps) {
  const devsQuery = useDevs();
  const projectsQuery = useProjects();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [isPersonal, setIsPersonal] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [needsQa, setNeedsQa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev));
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim()) return setError("Give the task a title.");
    if (!deadline) return setError("Set a deadline.");
    if (!isPersonal && assigneeIds.length === 0) return setError("Mark this personal or assign at least one dev.");

    setBusy(true);
    try {
      const res = await apiFetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          isPersonal,
          assigneeDevIds: isPersonal ? [] : assigneeIds,
          deadline: new Date(deadline).toISOString(),
          needsQa,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create the task.");
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose}>
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

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={isPersonal}
            onChange={(e) => {
              setIsPersonal(e.target.checked);
              if (e.target.checked) setAssigneeIds([]);
            }}
          />
          Personal task (just for me)
        </label>

        {!isPersonal && (
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

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={needsQa} onChange={(e) => setNeedsQa(e.target.checked)} />
          Needs QA review before it's done
        </label>

        {error && <p className="text-xs text-blocked">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create task"}
        </button>
      </div>
    </Modal>
  );
}
