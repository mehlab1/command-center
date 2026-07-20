const geminiChat = jest.fn();
const groqChat = jest.fn();

jest.mock("./gemini", () => ({ geminiChat: (...args: unknown[]) => geminiChat(...args) }));
jest.mock("./groq", () => ({ groqChat: (...args: unknown[]) => groqChat(...args) }));

import { llmRouter } from "./router";
import { LlmProviderError } from "./types";

beforeEach(() => jest.clearAllMocks());

describe("llmRouter.chat", () => {
  it("uses Gemini when it succeeds", async () => {
    geminiChat.mockResolvedValueOnce({ provider: "gemini", content: "hi" });

    const res = await llmRouter.chat([], []);

    expect(res.provider).toBe("gemini");
    expect(groqChat).not.toHaveBeenCalled();
  });

  it("falls back to Groq on a Gemini rate-limit error, and the interaction still completes", async () => {
    geminiChat.mockRejectedValueOnce(new LlmProviderError("gemini", 429, "rate limited"));
    groqChat.mockResolvedValueOnce({ provider: "groq", content: "hi from groq" });

    const res = await llmRouter.chat([], []);

    expect(res.provider).toBe("groq");
    expect(res.content).toBe("hi from groq");
    expect(geminiChat).toHaveBeenCalledTimes(1);
    expect(groqChat).toHaveBeenCalledTimes(1);
  });

  it("falls back to Groq on any Gemini error, not just 429", async () => {
    geminiChat.mockRejectedValueOnce(new Error("network blip"));
    groqChat.mockResolvedValueOnce({ provider: "groq", content: "still works" });

    const res = await llmRouter.chat([], []);

    expect(res.provider).toBe("groq");
  });

  it("propagates the error if both providers fail", async () => {
    geminiChat.mockRejectedValueOnce(new LlmProviderError("gemini", 500, "down"));
    groqChat.mockRejectedValueOnce(new LlmProviderError("groq", 500, "also down"));

    await expect(llmRouter.chat([], [])).rejects.toThrow("also down");
  });
});
