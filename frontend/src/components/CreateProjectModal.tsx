"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { apiFetch } from "@/lib/api";

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";
const labelClass = "text-xs text-text-muted";

export function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give the project a name.");

    setBusy(true);
    try {
      const res = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't create the project.");
      }
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Description (optional)</span>
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Category (optional)</span>
          <input
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Client — X, Internal, Personal"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Deadline (optional)</span>
          <input type="datetime-local" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>

        {error && <p className="text-xs text-blocked">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>
    </Modal>
  );
}
