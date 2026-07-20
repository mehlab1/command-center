import { prisma } from "../lib/prisma";

export type EntityType = "dev" | "pod" | "project" | "task" | "vault_item";

export interface ResolutionCandidate {
  id: string;
  name: string;
  similarity: number;
}

export type ResolutionResult =
  | { status: "resolved"; id: string; name: string }
  | { status: "ambiguous"; candidates: ResolutionCandidate[] }
  | { status: "not_found" };

// (table, column) — tasks are matched on `title`, not `name`.
const TABLE_COLUMN: Record<EntityType, { table: string; column: string }> = {
  dev: { table: "devs", column: "name" },
  pod: { table: "pods", column: "name" },
  project: { table: "projects", column: "name" },
  task: { table: "tasks", column: "title" },
  vault_item: { table: "vault_items", column: "name" },
};

// exact -> case-insensitive -> substring ("Nadia" in "Nadia Iqbal") ->
// fuzzy/trigram threshold -> ambiguous/not-found. Deterministic and
// explainable on purpose (docs/03-agent-and-llm.md) — never left to LLM
// judgment.
const FUZZY_THRESHOLD = 0.3;
const CONFIDENT_THRESHOLD = 0.55;

export async function resolveEntity(query: string, type: EntityType): Promise<ResolutionResult> {
  const { table, column } = TABLE_COLUMN[type];
  const trimmed = query.trim();
  if (!trimmed) return { status: "not_found" };

  const exact = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, "${column}" AS name FROM "${table}" WHERE "${column}" = $1`,
    trimmed
  );
  if (exact.length === 1) return { status: "resolved", id: exact[0].id, name: exact[0].name };
  if (exact.length > 1) {
    return { status: "ambiguous", candidates: exact.map((r) => ({ ...r, similarity: 1 })) };
  }

  const caseInsensitive = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, "${column}" AS name FROM "${table}" WHERE lower("${column}") = lower($1)`,
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

  // Handles "Nadia" -> "Nadia Iqbal" deterministically. Trigram similarity
  // penalizes length differences heavily, so a short first-name query can
  // score below CONFIDENT_THRESHOLD against its own unique full-name match
  // and get wrongly reported as "ambiguous" with a single candidate — a
  // plain substring check sidesteps that entirely.
  const substring = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
    `SELECT id, "${column}" AS name FROM "${table}" WHERE "${column}" ILIKE '%' || $1 || '%'`,
    trimmed
  );
  if (substring.length === 1) {
    return { status: "resolved", id: substring[0].id, name: substring[0].name };
  }
  if (substring.length > 1) {
    return { status: "ambiguous", candidates: substring.map((r) => ({ ...r, similarity: 1 })) };
  }

  const fuzzy = await prisma.$queryRawUnsafe<{ id: string; name: string; similarity: number }[]>(
    `SELECT id, "${column}" AS name, similarity("${column}", $1) AS similarity
     FROM "${table}"
     WHERE similarity("${column}", $1) > $2
     ORDER BY similarity DESC
     LIMIT 5`,
    trimmed,
    FUZZY_THRESHOLD
  );

  if (fuzzy.length === 0) return { status: "not_found" };

  const [top, second] = fuzzy;
  // A single fuzzy candidate can't be "ambiguous" — there's nothing else it
  // could be confused with — so accept it once it's cleared the base
  // FUZZY_THRESHOLD floor rather than also requiring CONFIDENT_THRESHOLD.
  const isConfident = !second || (top.similarity >= CONFIDENT_THRESHOLD && top.similarity - second.similarity >= 0.15);
  if (isConfident) return { status: "resolved", id: top.id, name: top.name };

  return { status: "ambiguous", candidates: fuzzy };
}
