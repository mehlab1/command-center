import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth";
import { recordAudit } from "../services/auditService";
import { AuditActionType, AuditSource } from "@prisma/client";
import * as vaultService from "../services/vaultService";

// Everything in this router is a plain authenticated REST endpoint, never
// touched by the LLM router — this is the bypass mechanism itself
// (docs/05-vault-and-security.md), not just protected by it.
export const vaultRouter = Router();
vaultRouter.use(requireAuth);

vaultRouter.get("/", async (req, res) => {
  const folder = typeof req.query.folder === "string" ? req.query.folder : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.status(200).json(await vaultService.listVaultItems({ folder, tag, q }));
});

vaultRouter.get("/:id", async (req, res) => {
  const item = await vaultService.getVaultItemMetadata(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Vault item not found" });
    return;
  }
  res.status(200).json(item);
});

const secretSchema = z.object({ value: z.string().min(1) });

vaultRouter.post("/:id/secret", async (req, res) => {
  const parsed = secretSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A non-empty value is required" });
    return;
  }
  const item = await vaultService.getVaultItemMetadata(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Vault item not found" });
    return;
  }

  await vaultService.setSecretValue(req.params.id, parsed.data.value);

  // Per docs/05-vault-and-security.md — the diff records only that the
  // value changed, never the plaintext or ciphertext itself.
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "vault_item",
    entityId: req.params.id,
    summary: `Set the secret value for "${item.name}".`,
    diff: { secret_value: "[updated]" },
    source: AuditSource.DASHBOARD,
  });

  res.status(200).json({ ok: true });
});

vaultRouter.get("/:id/secret", async (req, res) => {
  const value = await vaultService.getSecretValue(req.params.id);
  if (value === null) {
    res.status(404).json({ error: "No secret value stored for this item" });
    return;
  }
  res.status(200).json({ value });
});

const fileSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

vaultRouter.post("/:id/file", async (req, res) => {
  const parsed = fileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "fileName, mimeType, and dataBase64 are all required" });
    return;
  }
  const item = await vaultService.getVaultItemMetadata(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Vault item not found" });
    return;
  }

  const bytes = Buffer.from(parsed.data.dataBase64, "base64");
  await vaultService.setFileAttachment(req.params.id, parsed.data.fileName, parsed.data.mimeType, bytes);

  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "vault_item",
    entityId: req.params.id,
    summary: `Attached a file to "${item.name}".`,
    diff: { file_attachment: "[updated]" },
    source: AuditSource.DASHBOARD,
  });

  res.status(200).json({ ok: true });
});

vaultRouter.get("/:id/file", async (req, res) => {
  const file = await vaultService.getFileAttachment(req.params.id);
  if (!file) {
    res.status(404).json({ error: "No file attached to this item" });
    return;
  }
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
  res.status(200).send(file.bytes);
});
