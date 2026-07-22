process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";
process.env.GREEN_API_ID_INSTANCE = "1234567890";
process.env.GREEN_API_TOKEN_INSTANCE = "test-token";

import { sendWhatsAppMessage } from "./greenApi";

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
