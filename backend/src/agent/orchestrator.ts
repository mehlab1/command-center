import { ChatRole, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { llmRouter } from "../llm/router";
import { LlmMessage, LlmToolCall } from "../llm/types";
import { resolveEntity } from "./disambiguation";
import { ALL_TOOLS, READ_TOOL_NAMES, SYSTEM_PROMPT, WRITE_TOOL_NAMES } from "./tools";
import { WRITE_PREPARERS, PrepareResult } from "./writeHandlers";
import { executeWrite } from "./execute";
import { APP_TIMEZONE, APP_UTC_OFFSET } from "../lib/dateFormat";

const MAX_ITERATIONS = 4;
const HISTORY_WINDOW = 20;

export type OrchestratorResult =
  | { type: "message"; message: string }
  | { type: "confirm"; message: string; pendingActionId: string };

export interface ConfirmResult {
  message: string;
  entityType: string;
  entityId: string;
  next?: { message: string; pendingActionId: string };
}

async function saveMessage(role: ChatRole, content: string): Promise<void> {
  await prisma.chatMessage.create({ data: { role, content } });
}

async function recentHistoryAsLlmMessages(): Promise<LlmMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
  });
  return rows
    .reverse()
    .map((row) => ({
      role: row.role === ChatRole.USER ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }));
}

async function describeResolution(
  query: string,
  type: "dev" | "pod" | "project" | "task",
  label: string
): Promise<string> {
  const result = await resolveEntity(query, type);
  if (result.status === "resolved") return `Found ${label}: "${result.name}".`;
  if (result.status === "ambiguous") {
    return `Multiple ${label}s could match "${query}": ${result.candidates.map((c) => c.name).join(", ")}. Ask the user which one they mean.`;
  }
  return `No ${label} found matching "${query}".`;
}

async function executeReadTool(name: string, args: Record<string, unknown>): Promise<string> {
  const query = (args.query as string) ?? "";
  switch (name) {
    case "search_dev":
      return describeResolution(query, "dev", "dev");
    case "search_project":
      return describeResolution(query, "project", "project");
    case "search_pod":
      return describeResolution(query, "pod", "pod");
    case "search_task":
      return describeResolution(query, "task", "task");
    default:
      return "Unknown lookup tool.";
  }
}

// A short human label for a tool call, used to identify which item a
// missing-field question is about when several are asked in one combined
// message (e.g. "Dave: is he permanent or an intern?").
function labelForCall(call: LlmToolCall): string {
  const args = call.args;
  for (const key of ["name", "title", "dev_query", "task_query", "project_query", "pod_query"]) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  return call.name.replace(/_/g, " ");
}

interface QueuedItem {
  toolName: string;
  resolvedArgs: Record<string, unknown>;
  summary: string;
}

// Runs prepareWrite for every write call from a single LLM turn. If it's
// just one call, behavior is identical to before. If there are several
// (the user described multiple devs/tasks/projects in one message), any
// still-incomplete items are combined into ONE question naming each item,
// and nothing is queued until every item in the batch is fully resolved —
// only then do items get queued for sequential confirmation.
async function handleWriteBatch(calls: LlmToolCall[]): Promise<OrchestratorResult> {
  const prepared = await Promise.all(
    calls.map(async (call) => ({ call, result: await WRITE_PREPARERS[call.name](call.args) }))
  );

  const notReady = prepared.filter((p) => p.result.status !== "ready");

  if (notReady.length > 0) {
    let message: string;
    if (prepared.length === 1) {
      message = (notReady[0].result as Exclude<PrepareResult, { status: "ready" }>).message;
    } else {
      const readyCount = prepared.length - notReady.length;
      const intro =
        readyCount > 0
          ? `Got ${readyCount} of ${prepared.length} — still need a few things:`
          : `A few things I need before I can confirm any of these:`;
      const lines = notReady.map(
        (p) => `- ${labelForCall(p.call)}: ${(p.result as Exclude<PrepareResult, { status: "ready" }>).message}`
      );
      message = [intro, ...lines].join("\n");
    }
    await saveMessage(ChatRole.AGENT, message);
    return { type: "message", message };
  }

  const items: QueuedItem[] = prepared.map((p) => {
    const ready = p.result as Extract<PrepareResult, { status: "ready" }>;
    return { toolName: p.call.name, resolvedArgs: ready.resolvedArgs, summary: ready.summary };
  });

  // A fresh, fully-resolved batch replaces any stale pending state —
  // single-user, single-flow-at-a-time, same principle as the original
  // single-item PendingAction behavior.
  await prisma.pendingAction.deleteMany({});
  await prisma.pendingBatchQueue.deleteMany({});

  const [first, ...rest] = items;
  const total = items.length;

  const pendingRow = await prisma.pendingAction.create({
    data: {
      toolName: first.toolName,
      args: first.resolvedArgs as Prisma.InputJsonValue,
      summary: first.summary,
    },
  });

  if (rest.length > 0) {
    await prisma.pendingBatchQueue.createMany({
      data: rest.map((item, idx) => ({
        order: idx,
        position: idx + 2,
        total,
        toolName: item.toolName,
        resolvedArgs: item.resolvedArgs as Prisma.InputJsonValue,
        summary: item.summary,
      })),
    });
  }

  const displaySummary = total > 1 ? `(1/${total}) ${first.summary}` : first.summary;
  await saveMessage(ChatRole.AGENT, displaySummary);
  return { type: "confirm", message: displaySummary, pendingActionId: pendingRow.id };
}

export async function handleUserMessage(content: string): Promise<OrchestratorResult> {
  await saveMessage(ChatRole.USER, content);

  const history = await recentHistoryAsLlmMessages();
  const now = new Date();
  const nowInKarachi = now.toLocaleString("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  let systemWithClock = `${SYSTEM_PROMPT}\n\nCurrent date/time in Mehlab's timezone, Pakistan Standard Time (${APP_TIMEZONE}, always ${APP_UTC_OFFSET}, no DST): ${nowInKarachi}. Use this for any relative date/time the user mentions ("tomorrow", "in 5 days", "11pm tonight", etc) — never guess or use your training cutoff.\n\nWhenever you produce an ISO 8601 datetime value for any tool argument (deadline, revised_deadline, etc), you MUST include the explicit ${APP_UTC_OFFSET} offset, e.g. "2026-07-23T23:00:00${APP_UTC_OFFSET}" for 11pm Mehlab's time. Never emit a bare/naive datetime and never use "Z"/UTC — Mehlab always means his own local time (Pakistan) when he states a time, even though the current-time value above is shown to you already converted to that zone for convenience. A date with no specific time (just "in 3 days") can be a plain date "2026-07-23" with no time component at all.\n\nIf the user describes several distinct things to create/change in one message (e.g. "add devs A, B, C, all permanent", or "create a project and two tasks in it"), call the appropriate tool once per distinct item, all in this same turn — you can return multiple tool calls at once. Don't just handle the first one and drop the rest.

This applies even when some items are missing a field you'd normally stop and ask about. Call the tool for EVERY distinct item mentioned regardless, filling in whatever fields you do have and simply omitting whichever field you don't — never silently skip an item because it's incomplete, and never ask about a missing field yourself in plain text when it's part of a multi-item message. The system inspects every item you call, figures out exactly what's missing on each one, and asks the user in a single combined message naming each item — this only works if you actually emit a tool call for every item, including the incomplete ones.`;

  // If a proposal is still awaiting confirmation, nothing has been written
  // yet — the LLM has no other way to know this, and without it a
  // correction like "I meant X, not Y" gets misread as editing something
  // that doesn't exist (observed in testing) instead of re-proposing the
  // same create/write with corrected details.
  const pending = await prisma.pendingAction.findFirst({ orderBy: { createdAt: "desc" } });
  if (pending) {
    systemWithClock += `\n\nThere is a proposal awaiting the user's confirmation that has NOT been written to the database yet: "${pending.summary}". If the user's next message confirms it, a separate confirm action (not you) handles that. If they're correcting or changing details instead, call the same kind of tool again (e.g. still create_*, never edit_* — nothing exists yet to edit) with the corrected information; the old proposal will be replaced automatically.`;
  }

  const workingMessages: LlmMessage[] = [{ role: "system", content: systemWithClock }, ...history];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await llmRouter.chat(workingMessages, ALL_TOOLS);
    const calls = response.toolCalls ?? [];

    if (calls.length === 0) {
      const text = response.content?.trim() || "Sorry, I didn't catch that — can you rephrase?";
      await saveMessage(ChatRole.AGENT, text);
      return { type: "message", message: text };
    }

    if (calls.length === 1) {
      const call = calls[0];

      if (READ_TOOL_NAMES.has(call.name)) {
        const resultText = await executeReadTool(call.name, call.args);
        workingMessages.push({ role: "assistant", toolCalls: [call] });
        workingMessages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: resultText });
        continue;
      }

      if (WRITE_TOOL_NAMES.has(call.name)) {
        return await handleWriteBatch([call]);
      }

      break; // unrecognized tool name — dead end, fall through to fallback
    }

    // Multiple calls in one turn: only write calls are actionable this way.
    // Any accompanying read calls are dropped rather than answered — entity
    // resolution happens deterministically server-side in each prepare*
    // function regardless of whether the model looked things up first.
    const writeCalls = calls.filter((c) => WRITE_TOOL_NAMES.has(c.name));
    if (writeCalls.length > 0) {
      return await handleWriteBatch(writeCalls);
    }

    break;
  }

  const fallback = "I'm having trouble figuring that out — can you rephrase or give more detail?";
  await saveMessage(ChatRole.AGENT, fallback);
  return { type: "message", message: fallback };
}

// Promotes the next queued batch item (if any) to a fresh PendingAction —
// shared by confirm and cancel, since either resolving or skipping the
// current item should advance to the next one automatically.
async function advanceBatchQueue(): Promise<{ message: string; pendingActionId: string } | undefined> {
  const next = await prisma.pendingBatchQueue.findFirst({ orderBy: { order: "asc" } });
  if (!next) return undefined;

  await prisma.pendingBatchQueue.delete({ where: { id: next.id } });
  const pendingRow = await prisma.pendingAction.create({
    data: { toolName: next.toolName, args: next.resolvedArgs as Prisma.InputJsonValue, summary: next.summary },
  });

  const displaySummary = `(${next.position}/${next.total}) ${next.summary}`;
  await saveMessage(ChatRole.AGENT, displaySummary);
  return { message: displaySummary, pendingActionId: pendingRow.id };
}

export async function confirmPendingAction(id: string): Promise<ConfirmResult | null> {
  const pending = await prisma.pendingAction.findUnique({ where: { id } });
  if (!pending) return null;

  const result = await executeWrite(
    pending.toolName,
    pending.args as Record<string, unknown>,
    pending.summary
  );
  await prisma.pendingAction.delete({ where: { id } });

  const message = `Done — ${pending.summary}`;
  await saveMessage(ChatRole.AGENT, message);

  const next = await advanceBatchQueue();
  return { message, ...result, next };
}

export async function cancelPendingAction(id: string): Promise<{ next?: { message: string; pendingActionId: string } } | null> {
  const pending = await prisma.pendingAction.findUnique({ where: { id } });
  if (!pending) return null;

  await prisma.pendingAction.delete({ where: { id } });
  await saveMessage(ChatRole.AGENT, "Okay, cancelled — nothing was changed.");

  const next = await advanceBatchQueue();
  return { next };
}
