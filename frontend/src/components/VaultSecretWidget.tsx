"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface VaultSecretWidgetProps {
  vaultItemId: string;
  itemName: string;
  hasSecret: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Deliberately not part of the chat UI at all — this is the LLM-bypass
// mechanism itself (docs/05-vault-and-security.md), not just styled
// differently. It POSTs straight to a plain REST endpoint the LLM router
// never sees.
export function VaultSecretWidget({ vaultItemId, itemName, hasSecret, onClose, onSaved }: VaultSecretWidgetProps) {
  const [value, setValue] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/vault/${vaultItemId}/secret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("save failed");
      setValue("");
      onSaved();
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enter secret value"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-sm rounded-t-lg sm:rounded-lg border-2 border-signal bg-paper p-4 flex flex-col gap-3">
        <div>
          <p className="tag-led inline-block text-xs font-semibold text-signal">[ SECURE ENTRY ]</p>
          <p className="text-base text-text mt-1.5 font-medium">{itemName}</p>
          <p className="text-xs text-text-muted mt-0.5">
            This value never goes through chat or the AI — it's sent straight to the vault, encrypted at rest.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              type={revealed ? "text" : "password"}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={hasSecret ? "Enter a new value to replace it" : "Enter the secret value"}
              className="flex-1 rounded-sm border border-line bg-ink px-3 py-2.5 text-sm text-text font-mono outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal"
            />
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="rounded-sm border border-line px-3 text-xs font-heading text-text-muted"
            >
              {revealed ? "HIDE" : "SHOW"}
            </button>
          </div>
          {error && <p className="text-xs text-blocked">{error}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !value.trim()}
            className="btn-tactile btn-tactile-signal flex-1 rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save securely"}
          </button>
        </div>
      </div>
    </div>
  );
}
