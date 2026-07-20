import { prisma } from "../lib/prisma";

export type EntityType = "dev" | "pod" | "project";

export interface ResolutionCandidate {
  id: string;
  name: string;
  similarity: number;
}

export type ResolutionResult =
  | { status: "resolved"; id: string; name: string }
  | { status: "ambiguous"; candidates: ResolutionCandidate[] }
  | { status: "not_found" };

const TABLE: Record<EntityType, string> = {
  dev: "devs",
  pod: "pods",
  project: "projects",
};

// exact -> case-insensitive -> fuzzy/trigram threshold -> ambiguous/not-found.
// Deterministic and explainable on purpose (docs/03-agent-and-llm.md) — never
// left to LLM judgment.
const FUZZY_THRESHOLD = 0.3;
const CONFIDENT_THRESHOLD = 0.55;

export async function resolveEntity(query: string, type: EntityType): Promise<ResolutionResult> {
  const table = TABLE[type];
  const trimmed = query.trim();
  if (!trimmed) return { status: "not_found" };

  const exact = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, name FROM "${table}" WHERE name = $1`,
    trimmed
  );
  if (exact.length === 1) return { status: "resolved", id: exact[0].id, name: exact[0].name };
  if (exact.length > 1) {
    return { status: "ambiguous", candidates: exact.map((r) => ({ ...r, similarity: 1 })) };
  }

  const caseInsensitive = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, name FROM "${table}" WHERE lower(name) = lower($1)`,
    trimmed
  );
  if (caseInsensitive.length === 1) {
    return { status: "resolved", id: caseInsensitive[0].id, name: caseInsensitive[0].name };
  }
  if (caseInsensitive.length > 1) {
    return {
      status: "ambiguous",
      candidates: caseInsensitive.map((r) => ({ ...r, similarity: 1 })),
    };
  }

  const fuzzy = await prisma.$queryRawUnsafe<{ id: string; name: string; similarity: number }[]>(
    `SELECT id, name, similarity(name, $1) AS similarity
     FROM "${table}"
     WHERE similarity(name, $1) > $2
     ORDER BY similarity DESC
     LIMIT 5`,
    trimmed,
    FUZZY_THRESHOLD
  );

  if (fuzzy.length === 0) return { status: "not_found" };

  const [top, second] = fuzzy;
  const isConfident = top.similarity >= CONFIDENT_THRESHOLD && (!second || top.similarity - second.similarity >= 0.15);
  if (isConfident) return { status: "resolved", id: top.id, name: top.name };

  return { status: "ambiguous", candidates: fuzzy };
}
