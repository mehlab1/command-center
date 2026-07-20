"use client";

import { useDevs, usePods } from "@/lib/queries";
import { DevDTO } from "@/lib/types";

function DevRow({ dev }: { dev: DevDTO }) {
  const overloaded = dev.openTaskCount >= 4;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div>
        <p className="text-sm text-text">
          {dev.name}
          {dev.isLead && <span className="text-signal text-xs ml-1.5">LEAD</span>}
        </p>
        <p className="text-xs text-text-muted">{dev.designation ?? dev.employmentType}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-heading ${overloaded ? "text-blocked" : "text-text"}`}>
          {dev.openTaskCount}
        </p>
        <p className="text-xs text-text-muted">{dev.isAssigned ? "open" : "free"}</p>
      </div>
    </div>
  );
}

export function PeoplePanel() {
  const { data: devs, isLoading: devsLoading } = useDevs();
  const { data: pods, isLoading: podsLoading } = usePods();

  if (devsLoading || podsLoading) {
    return (
      <section>
        <h2 className="font-heading text-lg text-text mb-2">People</h2>
        <p className="text-sm text-text-muted">Loading…</p>
      </section>
    );
  }

  // pod.members/pod.lead are raw dev rows with no computed fields — group the
  // fully-computed `devs` list by podId instead of rendering pod.members
  // directly (see queries.ts: only /api/devs runs devs through withComputed).
  const devById = new Map((devs ?? []).map((d) => [d.id, d]));
  const unpodded = (devs ?? []).filter((d) => !d.podId);

  return (
    <section>
      <h2 className="font-heading text-lg text-text mb-2">People</h2>
      {devs?.length === 0 && (
        <p className="text-sm text-text-muted">No devs yet — tell the agent about your first one.</p>
      )}
      <div className="flex flex-col gap-2">
        {pods?.map((pod) => {
          const members = pod.members.map((m) => devById.get(m.id)).filter((d): d is DevDTO => !!d);
          return (
            <div key={pod.id} className="rounded-md border border-line bg-paper p-3">
              <p className="text-sm font-medium text-text mb-1">{pod.name}</p>
              <div className="divide-y divide-line">
                {members.map((m) => (
                  <DevRow key={m.id} dev={m} />
                ))}
              </div>
            </div>
          );
        })}
        {unpodded.length > 0 && (
          <div className="rounded-md border border-line bg-paper p-3">
            <p className="text-sm font-medium text-text-muted mb-1">No pod</p>
            <div className="divide-y divide-line">
              {unpodded.map((d) => (
                <DevRow key={d.id} dev={d} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
