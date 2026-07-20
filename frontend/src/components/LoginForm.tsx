"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = "idle" | "submitting" | "waking";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("submitting");

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        onSlow: () => setStatus("waking"),
      });

      if (!res.ok) {
        setError("Wrong email or password.");
        setStatus("idle");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("idle");
    }
  }

  const isBusy = status === "submitting" || status === "waking";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg bg-paper border border-line p-6 flex flex-col gap-4"
    >
      <div>
        <h1 className="font-heading text-2xl font-semibold text-text tracking-tight">
          COMMAND CENTER
        </h1>
        <p className="text-sm text-text-muted mt-1">Log in to continue.</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-line bg-ink px-3 py-2.5 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-line bg-ink px-3 py-2.5 text-base text-text outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:border-signal"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-blocked">
          {error}
        </p>
      )}

      {status === "waking" && (
        <p role="status" className="text-sm text-text-muted">
          Waking things up — this happens after a bit of inactivity, just a few more seconds.
        </p>
      )}

      <button
        type="submit"
        disabled={isBusy}
        className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast font-semibold py-2.5 mt-2 outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-60"
      >
        {isBusy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
