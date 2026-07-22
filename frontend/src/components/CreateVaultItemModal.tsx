"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { apiFetch } from "@/lib/api";

interface CreateVaultItemModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";
const labelClass = "text-xs text-text-muted";

// Metadata only — name/folder/tags/notes. The secret value itself is
// deliberately not a field here; it's entered afterwards via
// VaultSecretWidget, which bypasses the LLM entirely (docs/05-vault-and-security.md).
export function CreateVaultItemModal({ onClose, onCreated }: CreateVaultItemModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give the entry a name.");

    setBusy(true);
    try {
      const res = await apiFetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          folder: folder.trim() || undefined,
          tags: tags.trim()
            ? tags.split(",").map((t) => t.trim()).filter(Boolean)
            : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't add the entry.");
      }
      queryClient.invalidateQueries({ queryKey: ["vault"] });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New vault entry" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Folder (optional)</span>
          <input className={inputClass} value={folder} onChange={(e) => setFolder(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Tags (optional, comma-separated)</span>
          <input className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Notes (optional)</span>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <p className="text-xs text-text-muted">
          You'll add the actual secret value next, through the secure entry widget — it never passes through chat.
        </p>

        {error && <p className="text-xs text-blocked">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add entry"}
        </button>
      </div>
    </Modal>
  );
}
