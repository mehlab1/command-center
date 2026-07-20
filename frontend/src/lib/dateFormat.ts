// Single-user, fixed timezone — matches backend/src/lib/dateFormat.ts.
// Always shown in this zone regardless of the browser's own timezone, so a
// deadline reads the same everywhere the app is opened from.
export const APP_TIMEZONE = "Asia/Karachi";

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-US", { timeZone: APP_TIMEZONE, month: "short", day: "numeric", year: "numeric" });
}

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

// Shows the time only when one was actually meaningfully set (not exactly
// local midnight, which is what a bare date-only deadline collapses to).
export function formatDeadline(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const timePart = date.toLocaleString("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true });
  const isMidnight =
    date.toLocaleString("en-US", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }) === "00:00";
  return isMidnight ? formatDate(date) : `${formatDate(date)}, ${timePart}`;
}
