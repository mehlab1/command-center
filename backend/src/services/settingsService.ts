import { prisma } from "../lib/prisma";

export const DAILY_DIGEST_TIME_KEY = "daily_digest_time";
export const WHATSAPP_NUMBER_KEY = "whatsapp_number";
export const WHATSAPP_COUNTRY_CODE_KEY = "whatsapp_country_code";
export const WHATSAPP_TARGET_TYPE_KEY = "whatsapp_target_type";
export const WHATSAPP_GROUP_ID_KEY = "whatsapp_group_id";
export const WHATSAPP_GROUP_NAME_KEY = "whatsapp_group_name";
export const DIGEST_PUSH_ENABLED_KEY = "digest_push_enabled";
export const DIGEST_WHATSAPP_ENABLED_KEY = "digest_whatsapp_enabled";

const DEFAULT_DIGEST_TIME = "08:00";
const DEFAULT_COUNTRY_CODE = "92"; // Pakistan — matches the app's single-tenant default timezone/audience
export type WhatsAppTargetType = "number" | "group";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getDailyDigestTime(): Promise<string> {
  return (await getSetting(DAILY_DIGEST_TIME_KEY)) ?? DEFAULT_DIGEST_TIME;
}

export async function getWhatsAppNumber(): Promise<string | null> {
  return getSetting(WHATSAPP_NUMBER_KEY);
}

export async function getWhatsAppCountryCode(): Promise<string | null> {
  return getSetting(WHATSAPP_COUNTRY_CODE_KEY);
}

export async function getWhatsAppGroupId(): Promise<string | null> {
  return getSetting(WHATSAPP_GROUP_ID_KEY);
}

export async function getWhatsAppGroupName(): Promise<string | null> {
  return getSetting(WHATSAPP_GROUP_NAME_KEY);
}

export async function getWhatsAppTargetType(): Promise<WhatsAppTargetType> {
  return (await getSetting(WHATSAPP_TARGET_TYPE_KEY)) === "group" ? "group" : "number";
}

// The stored whatsapp_number is always the FULL digits-with-country-code
// string (unchanged contract, since the agent's update_setting tool writes
// it directly without ever knowing about the country-code split). The
// Settings page additionally persists whatsapp_country_code purely so it can
// re-render the country dropdown + local-number field on next load — split
// it back out here, falling back to a best-effort default if the number was
// set some other way (e.g. via chat) and no split was ever recorded.
export async function getWhatsAppNumberParts(): Promise<{ countryCode: string; localNumber: string }> {
  const [full, storedCode] = await Promise.all([getWhatsAppNumber(), getWhatsAppCountryCode()]);
  // A legacy install may have a Green API group id sitting in whatsapp_number
  // (the field used to double as either shape) — that's never a real phone
  // number, so don't surface it as one in the number field.
  if (!full || full.endsWith("@g.us")) return { countryCode: storedCode ?? DEFAULT_COUNTRY_CODE, localNumber: "" };
  if (storedCode && full.startsWith(storedCode)) {
    return { countryCode: storedCode, localNumber: full.slice(storedCode.length) };
  }
  if (full.startsWith(DEFAULT_COUNTRY_CODE)) {
    return { countryCode: DEFAULT_COUNTRY_CODE, localNumber: full.slice(DEFAULT_COUNTRY_CODE.length) };
  }
  return { countryCode: DEFAULT_COUNTRY_CODE, localNumber: full };
}

// Resolves whichever target is actually active (number vs group) — this is
// what reminders and the daily digest send to, as opposed to the raw
// whatsapp_number setting which the Settings page/agent read and write.
export async function getWhatsAppTarget(): Promise<string | null> {
  const type = await getWhatsAppTargetType();
  return type === "group" ? getWhatsAppGroupId() : getWhatsAppNumber();
}

// Both default to enabled (unset key) so existing installs keep their
// current "push always, WhatsApp if configured" behavior until Mehlab
// explicitly changes it.
export async function getDigestPushEnabled(): Promise<boolean> {
  return (await getSetting(DIGEST_PUSH_ENABLED_KEY)) !== "false";
}

export async function getDigestWhatsAppEnabled(): Promise<boolean> {
  return (await getSetting(DIGEST_WHATSAPP_ENABLED_KEY)) !== "false";
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDigestTime(value: string): boolean {
  return HHMM_RE.test(value);
}

// Accepts either a plain phone number (with country code) or an
// already-complete Green API group chat id ("<id>@g.us") — the latter
// lets reminders go to a group instead of an individual chat.
export function isValidWhatsAppNumber(value: string): boolean {
  if (value.endsWith("@g.us")) return value.length > "@g.us".length;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function isValidCountryCode(value: string): boolean {
  return /^\d{1,4}$/.test(value);
}

export function isValidGroupId(value: string): boolean {
  return value.endsWith("@g.us") && value.length > "@g.us".length;
}
