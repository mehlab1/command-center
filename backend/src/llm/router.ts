import { geminiChat } from "./gemini";
import { groqChat } from "./groq";
import { LlmMessage, LlmProviderError, LlmResponse, LlmTool } from "./types";

// Thin, swappable abstraction (docs/03-agent-and-llm.md) — call sites never
// talk to a specific provider directly. Gemini is primary; any Gemini error
// (network failure, 429, 5xx, misconfiguration) falls back to Groq.
export const llmRouter = {
  async chat(messages: LlmMessage[], tools: LlmTool[]): Promise<LlmResponse> {
    try {
      return await geminiChat(messages, tools);
    } catch (err) {
      console.error("Gemini call failed, falling back to Groq:", describeError(err));
      return await groqChat(messages, tools);
    }
  },
};

function describeError(err: unknown): string {
  if (err instanceof LlmProviderError) return `[${err.provider} ${err.status ?? "?"}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
