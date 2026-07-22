import { env } from "../config/env";

// Same integration pattern as Awaaz's WhatsApp confirmations
// (docs/04-workflows.md) — a plain REST call to Green API's sendMessage
// endpoint, no SDK. `target` is either a digits-only phone number (built
// into an individual "<phone>@c.us" chat id) or an already-complete Green
// API chat id — an individual "<phone>@c.us" or a group "<id>@g.us" (the
// latter needed to send reminders into a group rather than a 1:1 chat,
// looked up once via Green API's own GetChats endpoint).
export async function sendWhatsAppMessage(target: string, message: string): Promise<void> {
  if (!env.greenApiIdInstance || !env.greenApiTokenInstance) {
    throw new Error("Green API is not configured (GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE)");
  }

  const chatId = target.includes("@") ? target : `${target.replace(/\D/g, "")}@c.us`;
  const url = `https://api.green-api.com/waInstance${env.greenApiIdInstance}/sendMessage/${env.greenApiTokenInstance}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Green API sendMessage failed: ${res.status} ${text}`);
  }
}

interface GreenApiChat {
  id: string;
  name?: string;
}

export interface WhatsAppGroupMatch {
  id: string;
  name: string;
  score: number; // 1 = exact (case-insensitive) name match
}

// GetChats returns every chat the instance is part of, individuals and
// groups alike, with no server-side search — so group lookup is "fetch
// everything, filter/score client-side." Cached briefly since group
// membership rarely changes mid-session and this saves a round trip on
// every keystroke of the Settings page's group search field.
let groupsCache: { groups: GreenApiChat[]; fetchedAt: number } | null = null;
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchGroups(): Promise<GreenApiChat[]> {
  if (groupsCache && Date.now() - groupsCache.fetchedAt < GROUPS_CACHE_TTL_MS) {
    return groupsCache.groups;
  }
  if (!env.greenApiIdInstance || !env.greenApiTokenInstance) {
    throw new Error("Green API is not configured (GREEN_API_ID_INSTANCE / GREEN_API_TOKEN_INSTANCE)");
  }

  const url = `https://api.green-api.com/waInstance${env.greenApiIdInstance}/getChats/${env.greenApiTokenInstance}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Green API getChats failed: ${res.status} ${text}`);
  }

  const chats = (await res.json()) as GreenApiChat[];
  const groups = chats.filter((c) => c.id.endsWith("@g.us"));
  groupsCache = { groups, fetchedAt: Date.now() };
  return groups;
}

// Looks up a known group id's display name — used to migrate a group id that
// was pasted directly into the old free-text WhatsApp field (before this app
// had a separate group concept) into a proper name once, on first read.
export async function getGroupName(groupId: string): Promise<string | null> {
  const groups = await fetchGroups();
  return groups.find((g) => g.id === groupId)?.name ?? null;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Fuzzy-matches a typed group name against every group the instance belongs
// to. Exact (case-insensitive) matches score 1; substring matches score
// 0.9; everything else falls back to edit-distance similarity. Callers treat
// anything below 1 as needing user confirmation ("did you mean X?").
export async function searchWhatsAppGroups(query: string): Promise<WhatsAppGroupMatch[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const groups = await fetchGroups();
  return groups
    .filter((g): g is GreenApiChat & { name: string } => !!g.name)
    .map((g) => {
      const lower = g.name.toLowerCase();
      let score: number;
      if (lower === q) score = 1;
      else if (lower.includes(q) || q.includes(lower)) score = 0.9;
      else score = similarity(lower, q);
      return { id: g.id, name: g.name, score };
    })
    .filter((m) => m.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
