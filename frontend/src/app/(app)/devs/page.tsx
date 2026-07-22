"use client";

import { useState } from "react";
import { useDevs } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { CreateDevModal } from "@/components/CreateDevModal";
import { DevDTO } from "@/lib/types";

function DevRow({ dev }: { dev: DevDTO }) {
  return (
    <a href={`/devs/${dev.id}`} className="block rounded-md border border-line bg-paper p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text">
          {dev.name}
          {dev.isLead && <span className="ml-1.5 text-xs text-signal">★ lead</span>}
        </p>
        <span className="text-xs text-text-muted">{dev.employmentType === "PERMANENT" ? "Permanent" : "Intern"}</span>
      </div>
      {dev.designation && <p className="text-xs text-text-muted">{dev.designation}</p>}
      <p className="text-xs text-text-muted">
        {dev.openTaskCount === 0 ? "no open tasks" : `${dev.openTaskCount} open task(s)`}
      </p>
    </a>
  );
}

export default function DevsPage() {
  const devsQuery = useDevs();
  const waking = useColdStartBanner([devsQuery]);
  const [creating, setCreating] = useState(false);

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

      <div className="flex flex-col gap-2">
        {devsQuery.data?.map((d) => (
          <DevRow key={d.id} dev={d} />
        ))}
      </div>

      {creating && <CreateDevModal onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}
