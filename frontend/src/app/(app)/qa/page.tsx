"use client";

import { useQaQueue } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";

const QA_STATUS_TO_TAG = {
  UNASSIGNED: "TODO",
  ASSIGNED: "IN_PROGRESS",
  PASSED: "DONE",
  SENT_BACK: "BLOCKED",
} as const;

export default function QaPage() {
  const qaQuery = useQaQueue();
  const waking = useColdStartBanner([qaQuery]);
  const entries = qaQuery.data;
  const open = entries?.filter((e) => e.status === "UNASSIGNED" || e.status === "ASSIGNED") ?? [];
  const resolved = entries?.filter((e) => e.status === "PASSED" || e.status === "SENT_BACK") ?? [];

  return (
    <div className="flex-1 p-4">
      <h1 className="font-heading text-xl text-text mb-3">QA queue</h1>

      {waking && <p role="status" className="text-sm text-text-muted mb-2">Waking things up — just a few more seconds.</p>}
      {qaQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {entries?.length === 0 && <p className="text-sm text-text-muted">Nothing in QA right now.</p>}

      <div className="flex flex-col gap-2">
        {[...open, ...resolved.slice(0, 10)].map((e) => (
          <a key={e.id} href={`/tasks/${e.task.id}`} className="block rounded-md border border-line bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-text">{e.task.title}</p>
              <StatusTag kind={QA_STATUS_TO_TAG[e.status]} />
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {e.assignedReviewer
                ? `Reviewer: ${e.assignedReviewer.name}`
                : e.suggestedReviewer
                  ? `Suggested: ${e.suggestedReviewer.name}`
                  : "No reviewer assigned"}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
