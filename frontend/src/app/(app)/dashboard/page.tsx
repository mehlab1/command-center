"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  useProjects,
  useDevs,
  usePods,
  useQaQueue,
  useDeadlineRadar,
  usePerformance,
} from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { ProjectsPanel } from "@/components/dashboard/ProjectsPanel";
import { PeoplePanel } from "@/components/dashboard/PeoplePanel";
import { QaPanel } from "@/components/dashboard/QaPanel";
import { DeadlinesRadar } from "@/components/dashboard/DeadlinesRadar";
import { PerformancePanel } from "@/components/dashboard/PerformancePanel";

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
  const pods = usePods();
  const qa = useQaQueue();
  const deadlines = useDeadlineRadar();
  const performance = usePerformance();

  const waking = useColdStartBanner([projects, devs, pods, qa, deadlines, performance]);

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
      <ProjectsPanel />
      <PeoplePanel />
      <QaPanel />
      <PerformancePanel />

      <a href="/audit" className="text-sm text-signal underline text-center mb-2">
        View audit log
      </a>
    </main>
  );
}
