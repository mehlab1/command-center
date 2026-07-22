"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTasks } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";
import { apiFetch } from "@/lib/api";
import { formatDeadline } from "@/lib/dateFormat";

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";

function MarkDoneForm({ taskId, isLate, onDone }: { taskId: string; isLate: boolean; onDone: () => void }) {
  const [missedDeadline, setMissedDeadline] = useState(isLate);
  const [cancelReminders, setCancelReminders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missedDeadline: isLate ? missedDeadline : false, cancelReminders }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't mark this done.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark this done.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-ink p-3 flex flex-col gap-2">
      {isLate && (
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={missedDeadline} onChange={(e) => setMissedDeadline(e.target.checked)} />
          Count as a missed deadline
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={cancelReminders} onChange={(e) => setCancelReminders(e.target.checked)} />
        Cancel any upcoming reminders on this task
      </label>
      {error && <p className="text-xs text-blocked">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Marking done…" : "Confirm — mark done"}
      </button>
    </div>
  );
}

function MarkBlockedForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [blockerDescription, setBlockerDescription] = useState("");
  const [revisedDeadline, setRevisedDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!blockerDescription.trim() || !revisedDeadline) {
      setError("Both what's blocking it and a revised deadline are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/blocked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerDescription, revisedDeadline: new Date(revisedDeadline).toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't mark this blocked.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark this blocked.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-ink p-3 flex flex-col gap-2">
      <textarea
        className={inputClass}
        rows={2}
        placeholder="What's blocking it?"
        value={blockerDescription}
        onChange={(e) => setBlockerDescription(e.target.value)}
      />
      <input
        type="datetime-local"
        className={inputClass}
        value={revisedDeadline}
        onChange={(e) => setRevisedDeadline(e.target.value)}
      />
      {error && <p className="text-xs text-blocked">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="btn-tactile rounded-sm border border-blocked text-blocked py-2 text-sm font-semibold disabled:opacity-60"
      >
        {busy ? "Marking blocked…" : "Confirm — mark blocked"}
      </button>
    </div>
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tasksQuery = useTasks();
  const waking = useColdStartBanner([tasksQuery]);

  const [action, setAction] = useState<"none" | "done" | "blocked">("none");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  const task = tasksQuery.data?.find((t) => t.id === params.id);

  function refetchAndReset() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setAction("none");
  }

  async function handleDelete() {
    if (!task) return;
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.push("/tasks");
    } catch {
      setDeleteBusy(false);
      setDeleteConfirming(false);
    }
  }

  if (waking) {
    return <p role="status" className="p-4 text-sm text-text-muted">Waking things up — just a few more seconds.</p>;
  }
  if (tasksQuery.isLoading) {
    return <p className="p-4 text-sm text-text-muted">Loading…</p>;
  }
  if (!task) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">Task not found.</p>
        <a href="/tasks" className="text-sm text-signal underline">Back to tasks</a>
      </div>
    );
  }

  const isOverdue = task.status !== "DONE" && new Date(task.deadline) < new Date();

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <a href="/tasks" className="text-xs text-text-muted font-heading">‹ TASKS</a>

      <div className="flex items-start justify-between gap-2">
        <h1 className="font-heading text-xl text-text">{task.title}</h1>
        <StatusTag kind={task.status} />
      </div>

      <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Assigned to</span>
          <span className="text-text">
            {task.isPersonal ? (
              "Personal"
            ) : task.assignees.length > 0 ? (
              task.assignees.map((a, i) => (
                <span key={a.dev.id}>
                  {i > 0 && ", "}
                  <a href={`/devs/${a.dev.id}`} className="text-signal underline">
                    {a.dev.name}
                  </a>
                </span>
              ))
            ) : (
              "Unassigned"
            )}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Deadline</span>
          <span className={isOverdue ? "text-blocked" : "text-text"}>{formatDeadline(task.deadline)}</span>
        </div>
        {task.project && (
          <div className="flex justify-between">
            <span className="text-text-muted">Project</span>
            <a href={`/projects/${task.project.id}`} className="text-signal underline">
              {task.project.name}
            </a>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-muted">QA</span>
          <span className="text-text">{task.needsQa ? task.qaQueueEntry?.status ?? "Pending" : "Not required"}</span>
        </div>
        {task.rating !== null && (
          <div className="flex justify-between">
            <span className="text-text-muted">Rating</span>
            <span className="text-text">{task.rating}/5</span>
          </div>
        )}
        {task.missedDeadline !== null && (
          <div className="flex justify-between">
            <span className="text-text-muted">Missed deadline</span>
            <span className={task.missedDeadline ? "text-blocked" : "text-done"}>{task.missedDeadline ? "Yes" : "No"}</span>
          </div>
        )}
        {task.status === "BLOCKED" && (
          <div className="rounded-sm bg-ink p-2 flex flex-col gap-1">
            <p className="text-xs text-text-muted">Blocked: {task.blockerDescription}</p>
            {task.revisedDeadline && (
              <p className="text-xs text-text-muted">Revised deadline: {formatDeadline(task.revisedDeadline)}</p>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <div>
          <p className="text-xs text-text-muted mb-1">Description</p>
          <p className="text-sm text-text">{task.description}</p>
        </div>
      )}
      {task.notes && (
        <div>
          <p className="text-xs text-text-muted mb-1">Notes</p>
          <p className="text-sm text-text">{task.notes}</p>
        </div>
      )}

      {task.status !== "DONE" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setAction(action === "done" ? "none" : "done")}
              className="btn-tactile btn-tactile-signal flex-1 rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold"
            >
              Mark done
            </button>
            <button
              onClick={() => setAction(action === "blocked" ? "none" : "blocked")}
              className="btn-tactile flex-1 rounded-sm border border-blocked text-blocked py-2 text-sm font-semibold"
            >
              Mark blocked
            </button>
          </div>
          {action === "done" && <MarkDoneForm taskId={task.id} isLate={isOverdue} onDone={refetchAndReset} />}
          {action === "blocked" && <MarkBlockedForm taskId={task.id} onDone={refetchAndReset} />}
        </div>
      )}

      <div className="mt-auto pt-4">
        {!deleteConfirming ? (
          <button onClick={() => setDeleteConfirming(true)} className="text-xs text-blocked underline">
            Delete this task
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Delete permanently?</span>
            <button onClick={handleDelete} disabled={deleteBusy} className="text-xs text-blocked font-semibold">
              {deleteBusy ? "Deleting…" : "Yes, delete"}
            </button>
            <button onClick={() => setDeleteConfirming(false)} className="text-xs text-text-muted">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
