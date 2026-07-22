"use client";

import { useMemo, useState } from "react";
import { useDevs, usePods, useTasks } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { CreateDevModal } from "@/components/CreateDevModal";
import { DevDTO } from "@/lib/types";

interface DevAlert {
  glow: boolean;
  message: string | null;
}

function DevRow({ dev, alert }: { dev: DevDTO; alert: DevAlert }) {
  return (
    <a
      href={`/devs/${dev.id}`}
      className={`block rounded-md border bg-paper p-3 flex flex-col gap-1 ${alert.glow ? "alert-glow" : "border-line"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">
          {dev.name}
          {dev.isLead && <span className="ml-1.5 text-xs text-signal">★ lead</span>}
        </p>
        <span className="text-xs text-text-muted">{dev.employmentType === "PERMANENT" ? "Permanent" : "Intern"}</span>
      </div>
      {dev.designation && <p className="text-xs text-text-muted">{dev.designation}</p>}
      {alert.message ? (
        <p className="text-xs text-blocked font-medium">{alert.message}</p>
      ) : (
        <p className="text-xs text-text-muted">{dev.openTaskCount} open task(s)</p>
      )}
    </a>
  );
}

export default function DevsPage() {
  const devsQuery = useDevs();
  const podsQuery = usePods();
  const tasksQuery = useTasks();
  const waking = useColdStartBanner([devsQuery, podsQuery, tasksQuery]);
  const [creating, setCreating] = useState(false);

  // Two independent reasons a dev needs your attention: nothing assigned
  // (idle capacity), or something assigned that's now overdue (needs
  // chasing) — surfaced identically (a glowing card) so both are equally
  // hard to miss at a glance, per the user's explicit ask.
  const alerts = useMemo(() => {
    const map = new Map<string, DevAlert>();
    for (const dev of devsQuery.data ?? []) {
      const overdueTask = (tasksQuery.data ?? []).find(
        (t) => t.status !== "DONE" && new Date(t.deadline) < new Date() && t.assignees.some((a) => a.dev.id === dev.id)
      );
      if (overdueTask) {
        map.set(dev.id, { glow: true, message: `Overdue: "${overdueTask.title}"` });
      } else if (dev.openTaskCount === 0) {
        map.set(dev.id, { glow: true, message: "Idle — no tasks assigned" });
      } else {
        map.set(dev.id, { glow: false, message: null });
      }
    }
    return map;
  }, [devsQuery.data, tasksQuery.data]);

  const devById = new Map((devsQuery.data ?? []).map((d) => [d.id, d]));
  const unpodded = (devsQuery.data ?? []).filter((d) => !d.podId);

  return (
    <div className="flex-1 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-heading text-xl text-text">Devs</h1>
        <button
          onClick={() => setCreating(true)}
          className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast px-3 py-1.5 text-xs font-semibold"
        >
          + Add dev
        </button>
      </div>

      {waking && <p role="status" className="text-sm text-text-muted mb-2">Waking things up — just a few more seconds.</p>}
      {devsQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
      {devsQuery.data?.length === 0 && <p className="text-sm text-text-muted">No devs yet — add one to get started.</p>}

      <div className="flex flex-col gap-4">
        {podsQuery.data?.map((pod) => {
          const members = pod.members.map((m) => devById.get(m.id)).filter((d): d is DevDTO => !!d);
          if (members.length === 0) return null;
          return (
            <div key={pod.id}>
              <p className="text-xs text-text-muted font-heading mb-2">{pod.name.toUpperCase()}</p>
              <div className="flex flex-col gap-2">
                {members.map((d) => (
                  <DevRow key={d.id} dev={d} alert={alerts.get(d.id) ?? { glow: false, message: null }} />
                ))}
              </div>
            </div>
          );
        })}

        {unpodded.length > 0 && (
          <div>
            <p className="text-xs text-text-muted font-heading mb-2">NO POD</p>
            <div className="flex flex-col gap-2">
              {unpodded.map((d) => (
                <DevRow key={d.id} dev={d} alert={alerts.get(d.id) ?? { glow: false, message: null }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {creating && <CreateDevModal onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}
