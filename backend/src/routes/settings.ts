import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth";
import { recordAudit } from "../services/auditService";
import { AuditActionType, AuditSource } from "@prisma/client";
import {
  DAILY_DIGEST_TIME_KEY,
  WHATSAPP_NUMBER_KEY,
  getDailyDigestTime,
  getWhatsAppNumber,
  isValidDigestTime,
  isValidWhatsAppNumber,
  setSetting,
} from "../services/settingsService";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (_req, res) => {
  res.status(200).json({
    dailyDigestTime: await getDailyDigestTime(),
    whatsappNumber: await getWhatsAppNumber(),
  });
});

const patchSchema = z.object({
  dailyDigestTime: z.string().optional(),
  whatsappNumber: z.string().optional(),
});

settingsRouter.patch("/", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  if (parsed.data.dailyDigestTime !== undefined) {
    if (!isValidDigestTime(parsed.data.dailyDigestTime)) {
      res.status(400).json({ error: "dailyDigestTime must be 24-hour HH:mm" });
      return;
    }
    await setSetting(DAILY_DIGEST_TIME_KEY, parsed.data.dailyDigestTime);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: DAILY_DIGEST_TIME_KEY,
      summary: `Set the daily digest time to ${parsed.data.dailyDigestTime}.`,
      diff: { key: DAILY_DIGEST_TIME_KEY, value: parsed.data.dailyDigestTime },
      source: AuditSource.DASHBOARD,
    });
  }

  if (parsed.data.whatsappNumber !== undefined) {
    if (!isValidWhatsAppNumber(parsed.data.whatsappNumber)) {
      res.status(400).json({ error: "whatsappNumber must be 8-15 digits, with country code" });
      return;
    }
    await setSetting(WHATSAPP_NUMBER_KEY, parsed.data.whatsappNumber);
    await recordAudit({
      actionType: AuditActionType.EDIT,
      entityType: "setting",
      entityId: WHATSAPP_NUMBER_KEY,
      summary: `Set the WhatsApp reminder number to ${parsed.data.whatsappNumber}.`,
      diff: { key: WHATSAPP_NUMBER_KEY, value: parsed.data.whatsappNumber },
      source: AuditSource.DASHBOARD,
    });
  }

  res.status(200).json({
    dailyDigestTime: await getDailyDigestTime(),
    whatsappNumber: await getWhatsAppNumber(),
  });
});
