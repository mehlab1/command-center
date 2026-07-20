import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/requireAuth";
import { handleUserMessage, confirmPendingAction, cancelPendingAction } from "../agent/orchestrator";

export const chatRouter = Router();
chatRouter.use(requireAuth);

const messageSchema = z.object({ content: z.string().min(1) });

chatRouter.post("/message", async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  const result = await handleUserMessage(parsed.data.content);
  res.status(200).json(result);
});

const idSchema = z.object({ pendingActionId: z.string().uuid() });

chatRouter.post("/confirm", async (req, res) => {
  const parsed = idSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "pendingActionId is required" });
    return;
  }

  const result = await confirmPendingAction(parsed.data.pendingActionId);
  if (!result) {
    res.status(404).json({ error: "That confirmation has expired or was already handled." });
    return;
  }
  res.status(200).json(result);
});

chatRouter.post("/cancel", async (req, res) => {
  const parsed = idSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "pendingActionId is required" });
    return;
  }

  const ok = await cancelPendingAction(parsed.data.pendingActionId);
  if (!ok) {
    res.status(404).json({ error: "That confirmation has expired or was already handled." });
    return;
  }
  res.status(204).send();
});

chatRouter.get("/messages", async (_req, res) => {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  res.status(200).json(messages);
});

chatRouter.get("/pending", async (_req, res) => {
  const pending = await prisma.pendingAction.findFirst({ orderBy: { createdAt: "desc" } });
  res.status(200).json(pending);
});
