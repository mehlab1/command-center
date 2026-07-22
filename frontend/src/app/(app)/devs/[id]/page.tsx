"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDevs, usePerformance, usePods, useTasks } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { StatusTag } from "@/components/StatusTag";
import { RatingSparkline } from "@/components/dashboard/RatingSparkline";
import { OnTimeSequence } from "@/components/dashboard/OnTimeSequence";
import { apiFetch } from "@/lib/api";
import { formatDeadline } from "@/lib/dateFormat";

export default function DevDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const devsQuery = useDevs();
  const tasksQuery = useTasks();
  const podsQuery = usePods();
  const performanceQuery = usePerformance();
  const waking = useColdStartBanner([devsQuery, tasksQuery, podsQuery, performanceQuery]);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [acknowledgeOpenTasks, setAcknowledgeOpenTasks] = useState(false);

  const dev = devsQuery.data?.find((d) => d.id === params.id);
  const assignedTasks = tasksQuery.data?.filter((t) => t.assignees.some((a) => a.dev.id === params.id)) ?? [];
  const pod = podsQuery.data?.find((p) => p.leadDevId === params.id || p.members.some((m) => m.id === params.id));
  const performance = performanceQuery.data?.find((p) => p.devId === params.id);

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/devs/${params.id}?acknowledgedOpenTasks=${acknowledgeOpenTasks}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Couldn't delete this dev.");
      }
      queryClient.invalidateQueries({ queryKey: ["devs"] });
      router.push("/devs");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this dev.");
      setDeleteBusy(false);
    }
  }

  if (waking) {
    return <p role="status" className="p-4 text-sm text-text-muted">Waking things up — just a few more seconds.</p>;
  }
  if (devsQuery.isLoading) {
    return <p className="p-4 text-sm text-text-muted">Loading…</p>;
  }
  if (!dev) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">Dev not found.</p>
        <a href="/devs" className="text-sm text-signal underline">Back to devs</a>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <a href="/devs" className="text-xs text-text-muted font-heading">‹ DEVS</a>

      <div className="flex items-start justify-between gap-2">
        <h1 className="font-heading text-xl text-text">
          {dev.name}
          {dev.isLead && <span className="ml-2 text-sm text-signal">★ lead</span>}
        </h1>
        <span className="text-xs text-text-muted">{dev.employmentType === "PERMANENT" ? "Permanent" : "Intern"}</span>
      </div>

      <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-2 text-sm">
        {dev.designation && (
          <div className="flex justify-between">
            <span className="text-text-muted">Designation</span>
            <span className="text-text">{dev.designation}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-muted">Pod</span>
          <span className="text-text">{pod ? pod.name : "None"}</span>
        </div>
        {performance && (
          <>
            <div className="flex justify-between">
              <span className="text-text-muted">Avg rating</span>
              <span className="text-text">{performance.avgRating !== null ? `${performance.avgRating.toFixed(1)}/5` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">On-time %</span>
              <span className="text-text">{performance.onTimePercent !== null ? `${Math.round(performance.onTimePercent)}%` : "—"}</span>
            </div>
          </>
        )}
      </div>

      {performance && performance.history.length > 0 && (
        <div className="rounded-md border border-line bg-paper p-3">
          <p className="text-xs text-text-muted mb-1">Rating history</p>
          <RatingSparkline history={performance.history} />
          <div className="mt-1">
            <OnTimeSequence history={performance.history} />
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-text-muted mb-2">Assigned tasks ({assignedTasks.length})</p>
        {assignedTasks.length === 0 && <p className="text-sm text-text-muted">No tasks assigned.</p>}
        <div className="flex flex-col gap-2">
          {assignedTasks.map((t) => (
            <a key={t.id} href={`/tasks/${t.id}`} className="block rounded-md border border-line bg-paper p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text">{t.title}</p>
                <StatusTag kind={t.status} />
              </div>
              <p className="text-xs text-text-muted mt-1">due {formatDeadline(t.deadline)}</p>
            </a>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4">
        {!deleteConfirming ? (
          <button onClick={() => setDeleteConfirming(true)} className="text-xs text-blocked underline">
            Delete this dev
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-blocked p-3">
            {dev.openTaskCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-text">
                <input type="checkbox" checked={acknowledgeOpenTasks} onChange={(e) => setAcknowledgeOpenTasks(e.target.checked)} />
                I understand this dev has {dev.openTaskCount} open task(s)
              </label>
            )}
            {deleteError && <p className="text-xs text-blocked">{deleteError}</p>}
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} disabled={deleteBusy} className="text-xs text-blocked font-semibold">
                {deleteBusy ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setDeleteConfirming(false)} className="text-xs text-text-muted">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
