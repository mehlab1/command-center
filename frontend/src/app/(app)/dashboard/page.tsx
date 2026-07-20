// Placeholder — the real dashboard is built in Phase 4. This exists in Phase 1
// only so the login flow has a real authenticated destination to verify against.
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function DashboardPlaceholder() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEmail(data?.email ?? null))
      .finally(() => setChecked(true));
  }, []);

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
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="font-heading text-xl text-text">Logged in as {email}</h1>
      <p className="text-sm text-text-muted max-w-sm text-center">
        This is a placeholder — the real dashboard (projects, tasks, QA, vault) is built in
        Phase 4.
      </p>
      <a href="/audit" className="text-sm text-signal underline">
        View audit log
      </a>
      <button
        onClick={handleLogout}
        className="btn-tactile rounded-sm border border-line bg-paper px-4 py-2 text-sm text-text"
      >
        Log out
      </button>
    </main>
  );
}
