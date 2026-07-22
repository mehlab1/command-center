process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";
process.env.GREEN_API_ID_INSTANCE = "1234567890";
process.env.GREEN_API_TOKEN_INSTANCE = "test-token";

import { sendWhatsAppMessage, searchWhatsAppGroups } from "./greenApi";

describe("sendWhatsAppMessage — chat id construction", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("builds an individual chat id from a plain phone number", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendWhatsAppMessage("923001234567", "hello");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chatId).toBe("923001234567@c.us");
  });

  it("strips non-digit formatting from a plain phone number", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendWhatsAppMessage("+92 300 123 4567", "hello");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chatId).toBe("923001234567@c.us");
  });

  it("passes a group chat id straight through unmodified", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendWhatsAppMessage("120363431258900489@g.us", "hello");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chatId).toBe("120363431258900489@g.us");
  });

  it("throws a clear error when Green API rejects the send (e.g. quota exceeded)", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 466,
      text: async () => '{"description":"Monthly quota has been exceeded"}',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendWhatsAppMessage("120363431258900489@g.us", "hello")).rejects.toThrow(/466/);
  });
});

describe("searchWhatsAppGroups", () => {
  const originalFetch = global.fetch;
  const CHATS = [
    { id: "111@g.us", name: "Finova Dev Team" },
    { id: "222@g.us", name: "Finova Ops" },
    { id: "333@c.us", name: "Some Individual" }, // not a group — must be filtered out
    { id: "444@g.us" }, // no name — must be filtered out
  ];

  // getChats results are cached module-internally (see greenApi.ts) — reset
  // the module between tests so each one starts with a cold cache instead of
  // silently reusing a previous test's response.
  let search: typeof searchWhatsAppGroups;
  beforeEach(() => {
    jest.resetModules();
    search = require("./greenApi").searchWhatsAppGroups;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns an exact case-insensitive match with score 1", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => CHATS });
    global.fetch = fetchMock as unknown as typeof fetch;

    const matches = await search("finova ops");

    expect(matches[0]).toEqual({ id: "222@g.us", name: "Finova Ops", score: 1 });
  });

  it("caches getChats results across calls instead of refetching every search", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => CHATS });
    global.fetch = fetchMock as unknown as typeof fetch;

    await search("finova ops");
    await search("finova dev");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("finds a close-but-inexact match with a score below 1, for the 'did you mean' confirmation flow", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => CHATS });
    global.fetch = fetchMock as unknown as typeof fetch;

    const matches = await search("Finova Dev");

    expect(matches[0].id).toBe("111@g.us");
    expect(matches[0].score).toBeLessThan(1);
    expect(matches[0].score).toBeGreaterThan(0.4);
  });

  it("excludes individual chats and unnamed chats", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => CHATS });
    global.fetch = fetchMock as unknown as typeof fetch;

    const matches = await search("Some Individual");

    expect(matches.find((m) => m.id === "333@c.us")).toBeUndefined();
    expect(matches.find((m) => m.id === "444@g.us")).toBeUndefined();
  });

  it("returns no matches for an unrelated query", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => CHATS });
    global.fetch = fetchMock as unknown as typeof fetch;

    const matches = await search("Completely Unrelated Xyz");

    expect(matches).toEqual([]);
  });

  it("throws a clear error when Green API rejects getChats", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(search("anything")).rejects.toThrow(/500/);
  });
});
