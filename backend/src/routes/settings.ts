import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth";
import { recordAudit } from "../services/auditService";
import { AuditActionType, AuditSource } from "@prisma/client";
import {
  DAILY_DIGEST_TIME_KEY,
  WHATSAPP_NUMBER_KEY,
  WHATSAPP_COUNTRY_CODE_KEY,
  WHATSAPP_TARGET_TYPE_KEY,
  WHATSAPP_GROUP_ID_KEY,
  WHATSAPP_GROUP_NAME_KEY,
  getDailyDigestTime,
  getWhatsAppNumber,
  getWhatsAppNumberParts,
  getWhatsAppTargetType,
  getWhatsAppGroupId,
  getWhatsAppGroupName,
  isValidDigestTime,
  isValidWhatsAppNumber,
  isValidCountryCode,
  isValidGroupId,
  setSetting,
} from "../services/settingsService";
import { searchWhatsAppGroups, getGroupName } from "../lib/greenApi";
import { sendTestDigest } from "../services/notificationService";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

async function currentSettingsPayload() {
  const [dailyDigestTime, targetType, { countryCode, localNumber }, groupId, groupName, rawNumber] =
    await Promise.all([
      getDailyDigestTime(),
      getWhatsAppTargetType(),
      getWhatsAppNumberParts(),
      getWhatsAppGroupId(),
      getWhatsAppGroupName(),
      getWhatsAppNumber(),
    ]);

  // One-time migration: before groups were a first-class concept, a group id
  // could be pasted straight into the whatsapp_number field (the field's old
  // validator explicitly allowed either shape). Detect that on read and
  // promote it into the new group fields so the UI opens on the right tab
  // with a real name instead of showing a garbled "phone number".
  if (targetType === "number" && !groupId && rawNumber?.endsWith("@g.us")) {
    const resolvedName = (await getGroupName(rawNumber).catch(() => null)) ?? "Previously configured group";
    await Promise.all([
      setSetting(WHATSAPP_TARGET_TYPE_KEY, "group"),
      setSetting(WHATSAPP_GROUP_ID_KEY, rawNumber),
      setSetting(WHATSAPP_GROUP_NAME_KEY, resolvedName),
    ]);
    return currentSettingsPayload();
  }

  return {
    dailyDigestTime,
    whatsappTargetType: targetType,
    whatsappCountryCode: countryCode,
    whatsappLocalNumber: localNumber,
    whatsappGroupId: groupId,
    whatsappGroupName: groupName,
  };
}

settingsRouter.get("/", async (_req, res) => {
  res.status(200).json(await currentSettingsPayload());
});

// Placed before the generic PATCH "/" — not a conflict in Express (distinct
// paths) but the search endpoint must exist as its own route since it's a
// read against a live external API (Green API's GetChats), not a settings
// field.
settingsRouter.get("/whatsapp-groups/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) {
    res.status(200).json({ matches: [] });
    return;
  }
  try {
    const matches = await searchWhatsAppGroups(q);
    res.status(200).json({ matches });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to search WhatsApp groups" });
  }
});

// Lets the Settings page verify a WhatsApp target actually works without
// waiting for the scheduled digest time.
settingsRouter.post("/whatsapp-test-digest", async (_req, res) => {
  try {
    const result = await sendTestDigest();
    if (!result.sent) {
      res.status(400).json({ error: "No WhatsApp number or group is configured yet." });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to send the test digest" });
  }
});

const patchSchema = z.object({
  dailyDigestTime: z.string().optional(),
  whatsappTargetType: z.enum(["number", "group"]).optional(),
  whatsappCountryCode: z.string().optional(),
  whatsappLocalNumber: z.string().optional(),
  whatsappGroupId: z.string().optional(),
  whatsappGroupName: z.string().optional(),
});

settingsRouter.patch("/", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const body = parsed.data;

  if (body.dailyDigestTime !== undefined) {
    if (!isValidDigestTime(body.dailyDigestTime)) {
      res.status(400).json({ error: "dailyDigestTime must be 24-hour HH:mm" });
      return;
    }
    await setSetting(DAILY_DIGEST_TIME_KEY, body.dailyDigestTime);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: DAILY_DIGEST_TIME_KEY,
      summary: `Set the daily digest time to ${body.dailyDigestTime}.`,
      diff: { key: DAILY_DIGEST_TIME_KEY, value: body.dailyDigestTime },
      source: AuditSource.DASHBOARD,
    });
  }

  if (body.whatsappCountryCode !== undefined || body.whatsappLocalNumber !== undefined) {
    const countryCode = body.whatsappCountryCode ?? "";
    const localNumber = body.whatsappLocalNumber ?? "";
    if (!isValidCountryCode(countryCode)) {
      res.status(400).json({ error: "whatsappCountryCode must be 1-4 digits" });
      return;
    }
    const combined = `${countryCode}${localNumber.replace(/\D/g, "")}`;
    if (!isValidWhatsAppNumber(combined)) {
      res.status(400).json({ error: "WhatsApp number must be 8-15 digits including the country code" });
      return;
    }
    await setSetting(WHATSAPP_COUNTRY_CODE_KEY, countryCode);
    await setSetting(WHATSAPP_NUMBER_KEY, combined);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: WHATSAPP_NUMBER_KEY,
      summary: `Set the WhatsApp number to +${combined}.`,
      diff: { key: WHATSAPP_NUMBER_KEY, value: combined },
      source: AuditSource.DASHBOARD,
    });
  }

  if (body.whatsappGroupId !== undefined || body.whatsappGroupName !== undefined) {
    const groupId = body.whatsappGroupId ?? "";
    const groupName = body.whatsappGroupName ?? "";
    if (!isValidGroupId(groupId) || !groupName.trim()) {
      res.status(400).json({ error: "A confirmed WhatsApp group (id and name) is required" });
      return;
    }
    await setSetting(WHATSAPP_GROUP_ID_KEY, groupId);
    await setSetting(WHATSAPP_GROUP_NAME_KEY, groupName);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: WHATSAPP_GROUP_ID_KEY,
      summary: `Set the WhatsApp group to "${groupName}".`,
      diff: { key: WHATSAPP_GROUP_ID_KEY, value: groupId },
      source: AuditSource.DASHBOARD,
    });
  }

  if (body.whatsappTargetType !== undefined) {
    await setSetting(WHATSAPP_TARGET_TYPE_KEY, body.whatsappTargetType);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: WHATSAPP_TARGET_TYPE_KEY,
      summary: `Set the active WhatsApp target to ${body.whatsappTargetType === "group" ? "a group" : "a phone number"}.`,
      diff: { key: WHATSAPP_TARGET_TYPE_KEY, value: body.whatsappTargetType },
      source: AuditSource.DASHBOARD,
    });
  }

  res.status(200).json(await currentSettingsPayload());
});
