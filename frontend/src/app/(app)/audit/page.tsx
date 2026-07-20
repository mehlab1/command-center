// Minimal, functional-not-polished per Phase 2 — just enough to verify audit
// entries are actually being written correctly. Real dashboard is Phase 4.
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { StatusTag } from "@/components/StatusTag";
import { formatDateTime } from "@/lib/dateFormat";

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
      <h1 className="font-heading text-xl text-text mb-3">Audit log</h1>
      {entries === null && <p className="text-sm text-text-muted">Loading…</p>}
      {entries?.length === 0 && <p className="text-sm text-text-muted">No writes yet.</p>}
      <ul className="flex flex-col gap-2">
        {entries?.map((e) => (
          <li key={e.id} className="rounded-md border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <StatusTag kind={e.actionType} />
              <p className="text-xs text-text-muted">
                {e.entityType} · {e.source} · {formatDateTime(e.createdAt)}
              </p>
            </div>
            <p className="text-sm text-text mt-1.5">{e.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
