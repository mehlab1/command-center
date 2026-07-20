"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, useStandaloneReminders } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dateFormat";
import { requestPushToken } from "@/lib/firebase";
import { ReminderDTO } from "@/lib/types";

function NotificationOptIn() {
  const [status, setStatus] = useState<"idle" | "requesting" | "enabled" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function handleEnable() {
    setStatus("requesting");
    setErrorDetail(null);
    try {
      const token = await requestPushToken();
      const res = await apiFetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server rejected the token (${res.status}).`);
      }
      setStatus("enabled");
    } catch (err) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : "Unknown error.");
    }
  }

  return (
    <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-2">
      <p className="tag-led inline-block text-xs font-semibold text-text-muted self-start">[ NOTIFICATIONS ]</p>
      <p className="text-sm text-text-muted">
        Get pushed deadline warnings, the daily digest, and reminders on this device.
      </p>
      <button
        onClick={handleEnable}
        disabled={status === "requesting" || status === "enabled"}
        className="btn-tactile btn-tactile-signal rounded-sm bg-signal text-signal-contrast py-2 text-sm font-semibold disabled:opacity-60"
      >
        {status === "enabled" ? "Enabled on this device" : status === "requesting" ? "Requesting…" : "Enable notifications"}
      </button>
      {status === "error" && errorDetail && <p className="text-xs text-blocked">{errorDetail}</p>}
    </div>
  );
}

function SettingsForm() {
  const settingsQuery = useSettings();
  const queryClient = useQueryClient();
  const [digestTime, setDigestTime] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = settingsQuery.data;
  const digestValue = digestTime ?? current?.dailyDigestTime ?? "08:00";
  const whatsappValue = whatsappNumber ?? current?.whatsappNumber ?? "";

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyDigestTime: digestValue,
          whatsappNumber: whatsappValue || undefined,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      setError("Couldn't save settings — check the digest time (HH:mm) and WhatsApp number format.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-3">
      <p className="tag-led inline-block text-xs font-semibold text-text-muted self-start">[ SCHEDULE ]</p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">Daily digest time (24-hour)</span>
        <input
          type="time"
          value={digestValue}
          onChange={(e) => setDigestTime(e.target.value)}
          className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">WhatsApp number (with country code, optional)</span>
        <input
          type="text"
          value={whatsappValue}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="923001234567"
          className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text font-mono"
        />
      </label>

      {error && <p className="text-xs text-blocked">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function ReminderRow({ reminder }: { reminder: ReminderDTO }) {
  const next = reminder.occurrences.find((o) => o.status === "SCHEDULED");
  return (
    <div className="rounded-md border border-line bg-paper p-3 flex flex-col gap-1">
      <p className="text-sm text-text">{reminder.message}</p>
      <p className="text-xs text-text-muted">
        {reminder.channel} · {next ? `next ${formatDateTime(next.fireTime)}` : "no upcoming occurrence"}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const remindersQuery = useStandaloneReminders();
  const waking = useColdStartBanner([remindersQuery]);
  const reminders = remindersQuery.data;

  return (
    <div className="flex-1 p-4 flex flex-col gap-4">
      <h1 className="font-heading text-xl text-text">Settings</h1>

      <NotificationOptIn />
      <SettingsForm />

      <div>
        <p className="tag-led inline-block text-xs font-semibold text-text-muted mb-2">[ STANDALONE REMINDERS ]</p>
        {waking && (
          <p role="status" className="text-sm text-text-muted mb-2">
            Waking things up — this happens after a bit of inactivity, just a few more seconds.
          </p>
        )}
        {remindersQuery.isLoading && <p className="text-sm text-text-muted">Loading…</p>}
        {reminders?.length === 0 && (
          <p className="text-sm text-text-muted">No standalone reminders — tell the agent to remind you about something.</p>
        )}
        <div className="flex flex-col gap-2">
          {reminders?.map((r) => (
            <ReminderRow key={r.id} reminder={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
