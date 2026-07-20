// Single-user, fixed timezone — no per-request detection needed. Pinned by
// explicit user decision (Phase 4 hardening), not guessed.
export const APP_TIMEZONE = "Asia/Karachi";
export const APP_UTC_OFFSET = "+05:00"; // PKT has no DST, always +5.

export function nowInAppTimezone(): Date {
  return new Date();
}

// "Jul 23, 2026, 11:00 PM" — always in APP_TIMEZONE regardless of where the
// server process itself runs (Render's containers run in UTC).
export function formatDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Shows the time only when one was actually meaningfully set (not exactly
// local midnight, which is what a bare date-only deadline collapses to).
export function formatDeadline(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const timePart = date.toLocaleString("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
  const isMidnight = date.toLocaleString("en-US", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }) === "00:00";
  return isMidnight ? formatDate(date) : `${formatDate(date)}, ${timePart}`;
}
