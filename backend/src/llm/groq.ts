import { env } from "../config/env";
import { LlmMessage, LlmProviderError, LlmResponse, LlmTool } from "./types";

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

function toOpenAiMessages(messages: LlmMessage[]): OpenAiMessage[] {
  return messages.map((msg) => {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content ?? "",
        tool_call_id: msg.toolCallId ?? "",
      };
    }
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      return {
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      };
    }
    return { role: msg.role, content: msg.content ?? "" };
  });
}

function toOpenAiTools(tools: LlmTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function groqChat(messages: LlmMessage[], tools: LlmTool[]): Promise<LlmResponse> {
  if (!env.groqApiKey) {
    throw new LlmProviderError("groq", undefined, "GROQ_API_KEY not configured");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.groqApiKey}`,
    },
    body: JSON.stringify({
      model: env.groqModel,
      messages: toOpenAiMessages(messages),
      tools: toOpenAiTools(tools),
      tool_choice: "auto",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmProviderError("groq", res.status, `Groq error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: OpenAiToolCall[] } }[];
  };
  const message = data?.choices?.[0]?.message;

  const toolCalls = (message?.tool_calls ?? []).map((c: OpenAiToolCall) => ({
    id: c.id,
    name: c.function.name,
    args: safeJsonParse(c.function.arguments),
  }));

  return {
    content: message?.content ?? undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    provider: "groq",
  };
}

function safeJsonParse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
