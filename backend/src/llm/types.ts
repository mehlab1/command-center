export type LlmRole = "system" | "user" | "assistant" | "tool";

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: LlmRole;
  content?: string;
  // Only present on assistant messages that invoked tools.
  toolCalls?: LlmToolCall[];
  // Only present on "tool" messages — which call this is the result of.
  toolCallId?: string;
  toolName?: string;
}

// Parameters use a JSON-Schema-object subset — the intersection both
// Gemini's functionDeclarations and OpenAI-style tool schemas accept.
export interface LlmTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LlmResponse {
  content?: string;
  toolCalls?: LlmToolCall[];
  provider: "gemini" | "groq";
}

export class LlmProviderError extends Error {
  constructor(
    public provider: string,
    public status: number | undefined,
    message: string
  ) {
    super(message);
  }
}
