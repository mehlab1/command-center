import { env } from "../config/env";
import { LlmMessage, LlmProviderError, LlmResponse, LlmTool } from "./types";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

// Gemini requires contents to strictly alternate user/model turns — unlike
// the stored chat_messages table, which legitimately has consecutive AGENT
// rows back to back (e.g. a "(1/3) ..." confirmation summary immediately
// followed by "Done — ..." once confirmed, with no user message in
// between since confirm/cancel are separate button-driven requests, not a
// chat turn). Feeding that sequence straight through as separate "model"
// contents produced a 400 "invalid argument" on every real call once the
// batch/confirm flow made same-role runs common (found via live production
// history — 10 consecutive AGENT/AGENT pairs in the last 60 messages).
// Merging consecutive same-role turns into one content entry preserves the
// full text for the model while satisfying the alternation requirement.
export function toGeminiContents(messages: LlmMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  function push(role: "user" | "model", parts: GeminiPart[]): void {
    if (parts.length === 0) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  for (const msg of messages) {
    if (msg.role === "system") continue; // sent separately as systemInstruction

    if (msg.role === "user") {
      push("user", msg.content ? [{ text: msg.content }] : []);
    } else if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const call of msg.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      push("model", parts);
    } else if (msg.role === "tool") {
      push("user", [
        {
          functionResponse: {
            name: msg.toolName ?? "unknown",
            response: { result: msg.content ?? "" },
          },
        },
      ]);
    }
  }

  return contents;
}

function toGeminiTools(tools: LlmTool[]) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

export async function geminiChat(
  messages: LlmMessage[],
  tools: LlmTool[]
): Promise<LlmResponse> {
  if (!env.geminiApiKey) {
    throw new LlmProviderError("gemini", undefined, "GEMINI_API_KEY not configured");
  }

  const systemInstruction = messages.find((m) => m.role === "system")?.content;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;

  const body: Record<string, unknown> = {
    contents: toGeminiContents(messages),
    tools: toGeminiTools(tools),
    // No thinkingConfig here, deliberately: gemini-flash-lite-latest
    // rejects ANY thinkingConfig object outright with a 400 "invalid
    // argument" — found live (this was the actual root cause of chat
    // breaking constantly in real usage, previously misdiagnosed as only
    // a role-alternation issue). A prior model this app used may have
    // supported/required it, but "-latest" aliases can silently shift to
    // a different underlying version — verify support before re-adding
    // this for a different model rather than assuming it's still valid.
    // maxOutputTokens caps the free-tier request's token footprint the
    // same way as Groq's max_tokens below — a tool call or brief reply
    // never needs more (docs/03-agent-and-llm.md "keep replies short").
    generationConfig: { maxOutputTokens: 1024 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmProviderError("gemini", res.status, `Gemini error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];

  const textParts = parts.filter((p) => p.text).map((p) => p.text as string);
  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: `gemini-call-${i}-${Date.now()}`,
      name: p.functionCall!.name,
      args: p.functionCall!.args ?? {},
    }));

  return {
    content: textParts.length > 0 ? textParts.join("\n") : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    provider: "gemini",
  };
}
