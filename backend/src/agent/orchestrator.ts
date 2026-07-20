import { ChatRole, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { llmRouter } from "../llm/router";
import { LlmMessage } from "../llm/types";
import { resolveEntity } from "./disambiguation";
import { ALL_TOOLS, READ_TOOL_NAMES, SYSTEM_PROMPT, WRITE_TOOL_NAMES } from "./tools";
import { WRITE_PREPARERS } from "./writeHandlers";
import { executeWrite } from "./execute";

const MAX_ITERATIONS = 4;
const HISTORY_WINDOW = 20;

export type OrchestratorResult =
  | { type: "message"; message: string }
  | { type: "confirm"; message: string; pendingActionId: string };

export interface ConfirmResult {
  message: string;
  entityType: string;
  entityId: string;
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

async function describeResolution(query: string, type: "dev" | "pod" | "project", label: string): Promise<string> {
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
    default:
      return "Unknown lookup tool.";
  }
}

export async function handleUserMessage(content: string): Promise<OrchestratorResult> {
  await saveMessage(ChatRole.USER, content);

  const history = await recentHistoryAsLlmMessages();
  const workingMessages: LlmMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await llmRouter.chat(workingMessages, ALL_TOOLS);
    const call = response.toolCalls?.[0];

    if (!call) {
      const text = response.content?.trim() || "Sorry, I didn't catch that — can you rephrase?";
      await saveMessage(ChatRole.AGENT, text);
      return { type: "message", message: text };
    }

    if (READ_TOOL_NAMES.has(call.name)) {
      const resultText = await executeReadTool(call.name, call.args);
      workingMessages.push({ role: "assistant", toolCalls: [call] });
      workingMessages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: resultText });
      continue;
    }

    if (WRITE_TOOL_NAMES.has(call.name)) {
      const prepare = await WRITE_PREPARERS[call.name](call.args);

      if (prepare.status !== "ready") {
        await saveMessage(ChatRole.AGENT, prepare.message);
        return { type: "message", message: prepare.message };
      }

      // Single-user, single-flow-at-a-time: a new proposal supersedes any
      // stale one that was never confirmed or cancelled.
      await prisma.pendingAction.deleteMany({});
      const pending = await prisma.pendingAction.create({
        data: {
          toolName: call.name,
          args: prepare.resolvedArgs as Prisma.InputJsonValue,
          summary: prepare.summary,
        },
      });

      await saveMessage(ChatRole.AGENT, prepare.summary);
      return { type: "confirm", message: prepare.summary, pendingActionId: pending.id };
    }

    // Unrecognized tool name — treat as a dead end rather than looping forever.
    break;
  }

  const fallback = "I'm having trouble figuring that out — can you rephrase or give more detail?";
  await saveMessage(ChatRole.AGENT, fallback);
  return { type: "message", message: fallback };
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
  return { message, ...result };
}

export async function cancelPendingAction(id: string): Promise<boolean> {
  const pending = await prisma.pendingAction.findUnique({ where: { id } });
  if (!pending) return false;

  await prisma.pendingAction.delete({ where: { id } });
  await saveMessage(ChatRole.AGENT, "Okay, cancelled — nothing was changed.");
  return true;
}
