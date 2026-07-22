"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { apiFetch } from "@/lib/api";

interface CreateDevModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const inputClass =
  "w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal";
const labelClass = "text-xs text-text-muted";

export function CreateDevModal({ onClose, onCreated }: CreateDevModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [employmentType, setEmploymentType] = useState<"PERMANENT" | "INTERN">("PERMANENT");
  const [internshipEndDate, setInternshipEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Give the dev a name.");

    setBusy(true);
    try {
      const res = await apiFetch("/api/devs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          designation: designation.trim() || undefined,
          employmentType,
          internshipEndDate:
            employmentType === "INTERN" && internshipEndDate ? new Date(internshipEndDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't add the dev.");
      }
      queryClient.invalidateQueries({ queryKey: ["devs"] });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the dev.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New dev" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Designation (optional)</span>
          <input className={inputClass} value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Employment type</span>
          <select
            className={inputClass}
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as "PERMANENT" | "INTERN")}
          >
            <option value="PERMANENT">Permanent</option>
            <option value="INTERN">Intern</option>
          </select>
        </label>

        {employmentType === "INTERN" && (
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Internship end date (optional)</span>
            <input
              type="date"
              className={inputClass}
              value={internshipEndDate}
              onChange={(e) => setInternshipEndDate(e.target.value)}
            />
          </label>
        )}

        {error && <p className="text-xs text-blocked">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add dev"}
        </button>
      </div>
    </Modal>
  );
}
