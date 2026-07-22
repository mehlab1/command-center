"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useProjects, useDevs, useQaQueue, useDeadlineRadar, useTasks } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { DeadlinesRadar } from "@/components/dashboard/DeadlinesRadar";
import { SummaryCard } from "@/components/dashboard/SummaryCard";

// Redesigned to fix the reported clutter: previously every panel (projects,
// people, QA, performance) rendered its FULL list stacked on one screen.
// Now the dashboard is a light launcher — a handful of summary numbers,
// each linking to its own full page (/projects, /devs, /qa) — plus the
// deadlines radar, which stays here since "what needs attention right now"
// is exactly what a dashboard's first screen should answer.
export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEmail(data?.email ?? null))
      .finally(() => setChecked(true));
  }, []);

  const projects = useProjects();
  const devs = useDevs();
  const qa = useQaQueue();
  const deadlines = useDeadlineRadar();
  const tasks = useTasks();

  const waking = useColdStartBanner([projects, devs, qa, deadlines, tasks]);

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (!checked) {
    return <main className="flex-1 flex items-center justify-center p-4 text-text-muted">Loading…</main>;
  }

  if (!email) {
    return (
      <main className="flex-1 flex items-center justify-center p-4 text-text-muted">
        Not logged in. <a className="text-signal underline ml-1" href="/">Go to login</a>
      </main>
    );
  }

  const projectsNeedingAttention = projects.data?.filter((p) => p.taskCount === 0 || p.assignedTaskCount === 0).length ?? 0;
  const unassignedDevs = devs.data?.filter((d) => !d.isAssigned).length ?? 0;
  const openQa = qa.data?.filter((e) => e.status === "UNASSIGNED" || e.status === "ASSIGNED").length ?? 0;
  const openTasks = tasks.data?.filter((t) => t.status !== "DONE").length ?? 0;

  return (
    <main className="flex-1 flex flex-col gap-5 p-4 pb-2">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-text">Dashboard</h1>
        <button onClick={handleLogout} className="text-xs text-text-muted underline">
          Log out
        </button>
      </div>

      {waking && (
        <p role="status" className="text-sm text-text-muted -mt-2">
          Waking things up — this happens after a bit of inactivity, just a few more seconds.
        </p>
      )}

      <DeadlinesRadar />

      <div className="grid grid-cols-2 gap-2">
        <SummaryCard
          href="/projects"
          label="Projects"
          value={projects.data?.length ?? 0}
          note={projectsNeedingAttention > 0 ? `${projectsNeedingAttention} need attention` : "all on track"}
          alert={projectsNeedingAttention > 0}
        />
        <SummaryCard
          href="/devs"
          label="Devs"
          value={devs.data?.length ?? 0}
          note={unassignedDevs > 0 ? `${unassignedDevs} unassigned` : "all assigned"}
          alert={unassignedDevs > 0}
        />
        <SummaryCard
          href="/qa"
          label="QA queue"
          value={openQa}
          note={openQa > 0 ? "needs review" : "all clear"}
          alert={openQa > 0}
        />
        <SummaryCard href="/tasks" label="Tasks" value={openTasks} note="open · tap for board" />
      </div>

      <a href="/audit" className="text-sm text-signal underline text-center mb-2">
        View audit log
      </a>
    </main>
  );
}
