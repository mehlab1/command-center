"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings, useStandaloneReminders } from "@/lib/queries";
import { useColdStartBanner } from "@/lib/useColdStartBanner";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dateFormat";
import { requestPushToken, silentlyRefreshPushToken } from "@/lib/firebase";
import { ReminderDTO, WhatsAppGroupMatchDTO, WhatsAppTargetType } from "@/lib/types";
import { COUNTRY_CODES } from "@/lib/countryCodes";

function NotificationOptIn() {
  const [status, setStatus] = useState<"idle" | "requesting" | "enabled" | "error">("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // The button previously always read "Enable notifications" on every
  // visit, even after a successful opt-in, because status was plain local
  // React state with no check against reality. Notification.permission is
  // itself a durable per-origin browser setting, so on mount: if it's
  // already granted, re-derive the (stable) FCM token without re-prompting
  // and re-register it — reflects the real state and keeps the
  // registration fresh in one step, rather than just faking the label.
  useEffect(() => {
    let cancelled = false;
    async function checkExisting() {
      if (typeof window === "undefined" || Notification.permission !== "granted") return;
      const token = await silentlyRefreshPushToken();
      if (cancelled || !token) return;
      const res = await apiFetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!cancelled && res.ok) setStatus("enabled");
    }
    checkExisting();
    return () => {
      cancelled = true;
    };
  }, []);

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

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type GroupSearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "matched"; id: string; name: string }
  | { status: "confirm"; id: string; name: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

function GroupPicker({
  initialGroupId,
  initialGroupName,
  onResolved,
}: {
  initialGroupId: string | null;
  initialGroupName: string | null;
  onResolved: (group: { id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState(initialGroupName ?? "");
  const [state, setState] = useState<GroupSearchState>(
    initialGroupId && initialGroupName
      ? { status: "matched", id: initialGroupId, name: initialGroupName }
      : { status: "idle" }
  );
  const debouncedQuery = useDebouncedValue(query, 400);

  // Surface the already-saved group to the parent on mount, so hitting Save
  // without touching this field doesn't wrongly report "no group picked".
  useEffect(() => {
    if (initialGroupId && initialGroupName) onResolved({ id: initialGroupId, name: initialGroupName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.status === "matched" && state.name === debouncedQuery) return;
    let cancelled = false;
    (async () => {
      if (!debouncedQuery.trim()) {
        if (!cancelled) {
          setState({ status: "idle" });
          onResolved(null);
        }
        return;
      }
      setState({ status: "searching" });
      try {
        const res = await apiFetch(`/api/settings/whatsapp-groups/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (!res.ok) throw new Error("search failed");
        const body = (await res.json()) as { matches: WhatsAppGroupMatchDTO[] };
        if (cancelled) return;
        const top = body.matches[0];
        if (!top) {
          setState({ status: "not_found" });
          onResolved(null);
        } else if (top.score >= 0.999) {
          setState({ status: "matched", id: top.id, name: top.name });
          onResolved({ id: top.id, name: top.name });
        } else {
          setState({ status: "confirm", id: top.id, name: top.name });
          onResolved(null);
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Couldn't search WhatsApp groups — check the connection." });
          onResolved(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-muted">Group name</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Finova Dev Team"
          className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text"
        />
      </label>
      {state.status === "searching" && <p className="text-xs text-text-muted">Searching…</p>}
      {state.status === "matched" && (
        <p className="text-xs" style={{ color: "var(--done)" }}>
          ✓ Matched: {state.name}
        </p>
      )}
      {state.status === "confirm" && (
        <div className="rounded-sm border border-line bg-ink p-2 flex flex-col gap-1.5">
          <p className="text-xs text-text">
            Did you mean <span className="font-semibold">{state.name}</span>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setQuery(state.name);
                setState({ status: "matched", id: state.id, name: state.name });
                onResolved({ id: state.id, name: state.name });
              }}
              className="btn-tactile flex-1 rounded-sm bg-signal text-signal-contrast py-1.5 text-xs font-semibold"
            >
              Yes, that one
            </button>
            <button
              type="button"
              onClick={() => setState({ status: "not_found" })}
              className="btn-tactile flex-1 rounded-sm border border-line py-1.5 text-xs text-text-muted"
            >
              No
            </button>
          </div>
        </div>
      )}
      {state.status === "not_found" && (
        <p className="text-xs text-blocked">No matching group found — check the name and try again.</p>
      )}
      {state.status === "error" && <p className="text-xs text-blocked">{state.message}</p>}
    </div>
  );
}

function SettingsForm() {
  const settingsQuery = useSettings();
  const queryClient = useQueryClient();
  const current = settingsQuery.data;

  const [digestTime, setDigestTime] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<WhatsAppTargetType | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [localNumber, setLocalNumber] = useState<string | null>(null);
  const [resolvedGroup, setResolvedGroup] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const digestValue = digestTime ?? current?.dailyDigestTime ?? "08:00";
  const targetValue = targetType ?? current?.whatsappTargetType ?? "number";
  const countryValue = countryCode ?? current?.whatsappCountryCode ?? "92";
  const localValue = localNumber ?? current?.whatsappLocalNumber ?? "";

  function touch() {
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (targetValue === "group" && !resolvedGroup) {
      setError("Search for a WhatsApp group and confirm the match before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string> = { dailyDigestTime: digestValue, whatsappTargetType: targetValue };
      if (targetValue === "number") {
        body.whatsappCountryCode = countryValue;
        body.whatsappLocalNumber = localValue.replace(/\D/g, "");
      } else if (resolvedGroup) {
        body.whatsappGroupId = resolvedGroup.id;
        body.whatsappGroupName = resolvedGroup.name;
      }

      const res = await apiFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
    } catch {
      setError("Couldn't save settings — check the digest time and WhatsApp details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestDigest() {
    setTestState("sending");
    setTestError(null);
    try {
      const res = await apiFetch("/api/settings/whatsapp-test-digest", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Send failed");
      setTestState("sent");
    } catch (err) {
      setTestState("error");
      setTestError(err instanceof Error ? err.message : "Couldn't send the test digest.");
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
          onChange={(e) => {
            setDigestTime(e.target.value);
            touch();
          }}
          className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-text-muted">WhatsApp digest &amp; reminders go to</span>
        <div className="flex rounded-sm border border-line overflow-hidden self-start">
          <button
            type="button"
            onClick={() => {
              setTargetType("number");
              touch();
            }}
            className={`px-3 py-1.5 text-xs font-heading ${targetValue === "number" ? "bg-signal text-signal-contrast" : "text-text-muted"}`}
          >
            PHONE NUMBER
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType("group");
              touch();
            }}
            className={`px-3 py-1.5 text-xs font-heading ${targetValue === "group" ? "bg-signal text-signal-contrast" : "text-text-muted"}`}
          >
            GROUP
          </button>
        </div>
      </div>

      {targetValue === "number" ? (
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 w-[45%]">
            <span className="text-xs text-text-muted">Country</span>
            <select
              value={countryValue}
              onChange={(e) => {
                setCountryCode(e.target.value);
                touch();
              }}
              className="rounded-sm border border-line bg-ink px-2 py-2 text-sm text-text"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={`${c.code}-${c.name}`} value={c.code}>
                  {c.flag} +{c.code} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-text-muted">Number</span>
            <input
              type="tel"
              inputMode="numeric"
              value={localValue}
              onChange={(e) => {
                setLocalNumber(e.target.value.replace(/\D/g, ""));
                touch();
              }}
              placeholder="3001234567"
              className="rounded-sm border border-line bg-ink px-3 py-2 text-sm text-text font-mono"
            />
          </label>
        </div>
      ) : (
        <GroupPicker
          initialGroupId={current?.whatsappGroupId ?? null}
          initialGroupName={current?.whatsappGroupName ?? null}
          onResolved={(g) => {
            setResolvedGroup(g);
            setSaved(false);
          }}
        />
      )}

      {error && <p className="text-xs text-blocked">{error}</p>}
      {saved && !error && (
        <p className="text-xs" style={{ color: "var(--done)" }}>
          Saved.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={handleTestDigest}
          disabled={testState === "sending"}
          className="btn-tactile flex-1 rounded-sm border border-line bg-ink py-2 text-sm font-medium text-text disabled:opacity-60"
        >
          {testState === "sending" ? "Sending…" : "Send test digest"}
        </button>
      </div>
      {testState === "sent" && (
        <p className="text-xs" style={{ color: "var(--done)" }}>
          Test digest sent — check WhatsApp.
        </p>
      )}
      {testState === "error" && testError && <p className="text-xs text-blocked">{testError}</p>}
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
