process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";
process.env.GEMINI_API_KEY = "test-key";

import { toGeminiContents, geminiChat } from "./gemini";
import { LlmMessage } from "./types";

describe("toGeminiContents — role alternation", () => {
  it("merges consecutive assistant messages into one model content entry", () => {
    // Exact real-world shape: a batch confirmation summary immediately
    // followed by "Done — ..." once confirmed, with no user message in
    // between (confirm/cancel are separate requests, not a chat turn).
    const messages: LlmMessage[] = [
      { role: "user", content: "mark the report task done" },
      { role: "assistant", content: 'Mark "report" done (on time).' },
      { role: "assistant", content: 'Done — Mark "report" done (on time).' },
    ];

    const contents = toGeminiContents(messages);

    const roles = contents.map((c) => c.role);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }
    expect(contents).toHaveLength(2);
    expect(contents[1].role).toBe("model");
    expect(contents[1].parts.map((p) => p.text)).toEqual([
      'Mark "report" done (on time).',
      'Done — Mark "report" done (on time).',
    ]);
  });

  it("merges three or more consecutive same-role messages (batch queue + cancel)", () => {
    const messages: LlmMessage[] = [
      { role: "user", content: "add three devs" },
      { role: "assistant", content: "(1/3) Add dev Alice." },
      { role: "assistant", content: "Done — Add dev Alice." },
      { role: "assistant", content: "(2/3) Add dev Bob." },
    ];

    const contents = toGeminiContents(messages);

    const roles = contents.map((c) => c.role);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }
    expect(contents).toHaveLength(2);
    expect(contents[1].parts).toHaveLength(3);
  });

  it("still alternates normally for a well-formed conversation", () => {
    const messages: LlmMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "what's due today?" },
      { role: "assistant", content: "nothing due today" },
    ];

    const contents = toGeminiContents(messages);

    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user", "model"]);
  });

  it("merges a tool response into a preceding user-role entry without breaking alternation", () => {
    const messages: LlmMessage[] = [
      { role: "user", content: "who is on the marketing project?" },
      { role: "assistant", toolCalls: [{ id: "1", name: "search_project", args: { query: "marketing" } }] },
      { role: "tool", toolCallId: "1", toolName: "search_project", content: "Found project: Marketing Site." },
    ];

    const contents = toGeminiContents(messages);

    const roles = contents.map((c) => c.role);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1]);
    }
  });

  it("skips system messages and never emits an empty parts array", () => {
    const messages: LlmMessage[] = [
      { role: "system", content: "You are an agent." },
      { role: "user", content: "hello" },
    ];

    const contents = toGeminiContents(messages);

    expect(contents.every((c) => c.parts.length > 0)).toBe(true);
    expect(contents.some((c) => c.role === ("system" as never))).toBe(false);
  });
});

describe("geminiChat — request body", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("never sends a thinkingConfig field — gemini-flash-lite-latest rejects it outright with a 400 (found live in production)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "hi" }] } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await geminiChat([{ role: "user", content: "hello" }], []);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).not.toHaveProperty("thinkingConfig");
  });
});
