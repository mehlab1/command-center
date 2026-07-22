import { prisma } from "../lib/prisma";

export const DAILY_DIGEST_TIME_KEY = "daily_digest_time";
export const WHATSAPP_NUMBER_KEY = "whatsapp_number";

const DEFAULT_DIGEST_TIME = "08:00";

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
