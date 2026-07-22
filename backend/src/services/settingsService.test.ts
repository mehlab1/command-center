process.env.JWT_SECRET = "test-secret";
process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";

const settingFindUnique = jest.fn();
jest.mock("../lib/prisma", () => ({
  prisma: { setting: { findUnique: (...a: unknown[]) => settingFindUnique(...a) } },
}));

import {
  isValidDigestTime,
  isValidWhatsAppNumber,
  isValidCountryCode,
  isValidGroupId,
  getWhatsAppNumberParts,
  getDigestPushEnabled,
  getDigestWhatsAppEnabled,
} from "./settingsService";

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

describe("isValidCountryCode", () => {
  it("accepts 1-4 digit dial codes", () => {
    expect(isValidCountryCode("92")).toBe(true);
    expect(isValidCountryCode("1")).toBe(true);
    expect(isValidCountryCode("1264")).toBe(true);
  });

  it("rejects non-digits or overly long values", () => {
    expect(isValidCountryCode("+92")).toBe(false);
    expect(isValidCountryCode("12345")).toBe(false);
    expect(isValidCountryCode("")).toBe(false);
  });
});

describe("isValidGroupId", () => {
  it("accepts a non-empty Green API group chat id", () => {
    expect(isValidGroupId("120363431258900489@g.us")).toBe(true);
  });

  it("rejects a non-group id or an empty group id", () => {
    expect(isValidGroupId("923001234567@c.us")).toBe(false);
    expect(isValidGroupId("@g.us")).toBe(false);
  });
});

describe("getWhatsAppNumberParts", () => {
  function mockSettings(overrides: Record<string, string>) {
    settingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const value = overrides[where.key];
      return value !== undefined ? { value } : null;
    });
  }

  it("splits a number back into the stored country code and local digits", async () => {
    mockSettings({ whatsapp_number: "923001234567", whatsapp_country_code: "92" });
    expect(await getWhatsAppNumberParts()).toEqual({ countryCode: "92", localNumber: "3001234567" });
  });

  it("defaults to Pakistan (+92) when no split was ever recorded but the number starts with 92", async () => {
    mockSettings({ whatsapp_number: "923001234567" });
    expect(await getWhatsAppNumberParts()).toEqual({ countryCode: "92", localNumber: "3001234567" });
  });

  it("falls back to the full number as the local part when the country code can't be inferred", async () => {
    mockSettings({ whatsapp_number: "15551234567" });
    expect(await getWhatsAppNumberParts()).toEqual({ countryCode: "92", localNumber: "15551234567" });
  });

  it("returns an empty local number with the default country code when nothing is set", async () => {
    mockSettings({});
    expect(await getWhatsAppNumberParts()).toEqual({ countryCode: "92", localNumber: "" });
  });

  it("never surfaces a legacy group id (stored pre-migration in whatsapp_number) as a phone number", async () => {
    mockSettings({ whatsapp_number: "120363431258900489@g.us" });
    expect(await getWhatsAppNumberParts()).toEqual({ countryCode: "92", localNumber: "" });
  });
});

describe("getDigestPushEnabled / getDigestWhatsAppEnabled", () => {
  function mockSettings(overrides: Record<string, string>) {
    settingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const value = overrides[where.key];
      return value !== undefined ? { value } : null;
    });
  }

  it("default to enabled when unset — existing installs keep today's behavior", async () => {
    mockSettings({});
    expect(await getDigestPushEnabled()).toBe(true);
    expect(await getDigestWhatsAppEnabled()).toBe(true);
  });

  it("can be independently turned off", async () => {
    mockSettings({ digest_push_enabled: "false", digest_whatsapp_enabled: "true" });
    expect(await getDigestPushEnabled()).toBe(false);
    expect(await getDigestWhatsAppEnabled()).toBe(true);
  });

  it("both can be turned off at once", async () => {
    mockSettings({ digest_push_enabled: "false", digest_whatsapp_enabled: "false" });
    expect(await getDigestPushEnabled()).toBe(false);
    expect(await getDigestWhatsAppEnabled()).toBe(false);
  });
});
