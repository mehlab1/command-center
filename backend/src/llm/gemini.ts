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

function toGeminiContents(messages: LlmMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // sent separately as systemInstruction

    if (msg.role === "user") {
      contents.push({ role: "user", parts: [{ text: msg.content ?? "" }] });
    } else if (msg.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const call of msg.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      contents.push({ role: "model", parts });
    } else if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.toolName ?? "unknown",
              response: { result: msg.content ?? "" },
            },
          },
        ],
      });
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
    // 2.5-flash is a "thinking" model — without capping this, it can spend
    // its whole token budget on invisible reasoning and return truly empty
    // content, especially with a large tool set. Deterministic tool-routing
    // doesn't need visible chain-of-thought, so disable it outright.
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
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
