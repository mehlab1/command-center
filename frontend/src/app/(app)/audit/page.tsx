// Minimal, functional-not-polished per Phase 2 — just enough to verify audit
// entries are actually being written correctly. Real dashboard is Phase 4.
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface AuditLogEntry {
  id: string;
  actionType: "CREATE" | "EDIT" | "DELETE";
  entityType: string;
  entityId: string;
  summary: string;
  source: "CHAT" | "DASHBOARD";
  createdAt: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);

  useEffect(() => {
    apiFetch("/api/audit-log")
      .then((res) => (res.ok ? res.json() : []))
      .then(setEntries);
  }, []);

  return (
    <div className="flex-1 p-4">
      <h1 className="font-heading text-xl text-ink mb-3">Audit log</h1>
      {entries === null && <p className="text-sm text-ink-muted">Loading…</p>}
      {entries?.length === 0 && <p className="text-sm text-ink-muted">No writes yet.</p>}
      <ul className="flex flex-col gap-2">
        {entries?.map((e) => (
          <li key={e.id} className="rounded-md border border-border bg-surface-raised p-3">
            <p className="text-xs text-ink-muted">
              {new Date(e.createdAt).toLocaleString()} · {e.actionType} {e.entityType} · {e.source}
            </p>
            <p className="text-sm text-ink mt-1">{e.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
