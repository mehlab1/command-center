"use client";

import { useQaQueue } from "@/lib/queries";
import { StatusTag } from "@/components/StatusTag";

const QA_STATUS_TO_TAG = {
  UNASSIGNED: "TODO",
  ASSIGNED: "IN_PROGRESS",
  PASSED: "DONE",
  SENT_BACK: "BLOCKED",
} as const;

export function QaPanel() {
  const { data: entries, isLoading } = useQaQueue();
  const open = entries?.filter((e) => e.status === "UNASSIGNED" || e.status === "ASSIGNED") ?? [];
  const resolved = entries?.filter((e) => e.status === "PASSED" || e.status === "SENT_BACK") ?? [];

  return (
    <section>
      <h2 className="font-heading text-lg text-text mb-2">QA queue</h2>
      {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {entries?.length === 0 && <p className="text-sm text-text-muted">Nothing in QA right now.</p>}
      <div className="flex flex-col gap-2">
        {[...open, ...resolved.slice(0, 5)].map((e) => (
          <div key={e.id} className="rounded-md border border-line bg-paper p-3">
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
          </div>
        ))}
      </div>
    </section>
  );
}
