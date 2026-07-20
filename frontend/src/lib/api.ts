export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Tracks whether the backend has already responded once this session, so the
// "waking things up" message only shows on the genuinely slow first request
// per docs/07-frontend-design-system.md, not on every fast follow-up call.
let hasWarmedThisSession = false;
const SLOW_THRESHOLD_MS = 3000;

export interface ApiFetchOptions extends RequestInit {
  onSlow?: () => void;
  onSettled?: () => void;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { onSlow, onSettled, ...init } = options;
  const url = `${API_BASE_URL}${path}`;

  if (hasWarmedThisSession) {
    try {
      return await fetch(url, { credentials: "include", ...init });
    } finally {
      onSettled?.();
    }
  }

  let slowTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    slowTimer = null;
    onSlow?.();
  }, SLOW_THRESHOLD_MS);

  try {
    const res = await fetch(url, { credentials: "include", ...init });
    hasWarmedThisSession = true;
    return res;
  } finally {
    if (slowTimer) clearTimeout(slowTimer);
    onSettled?.();
  }
}
