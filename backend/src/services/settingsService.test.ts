process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";

jest.mock("../lib/prisma", () => ({ prisma: { setting: {} } }));

import { isValidDigestTime, isValidWhatsAppNumber } from "./settingsService";

describe("isValidWhatsAppNumber", () => {
  it("accepts a plausible phone number with country code", () => {
    expect(isValidWhatsAppNumber("923001234567")).toBe(true);
  });

  it("rejects a too-short or non-numeric value", () => {
    expect(isValidWhatsAppNumber("123")).toBe(false);
    expect(isValidWhatsAppNumber("not a number")).toBe(false);
  });

  it("accepts a Green API group chat id", () => {
    expect(isValidWhatsAppNumber("120363431258900489@g.us")).toBe(true);
  });

  it("rejects an empty group id", () => {
    expect(isValidWhatsAppNumber("@g.us")).toBe(false);
  });
});

describe("isValidDigestTime", () => {
  it("accepts valid 24-hour HH:mm", () => {
    expect(isValidDigestTime("08:00")).toBe(true);
    expect(isValidDigestTime("23:59")).toBe(true);
  });

  it("rejects 12-hour or malformed input", () => {
    expect(isValidDigestTime("8am")).toBe(false);
    expect(isValidDigestTime("24:00")).toBe(false);
    expect(isValidDigestTime("08:60")).toBe(false);
  });
});
