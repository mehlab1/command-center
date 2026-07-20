import { Router } from "express";
import { requireAuth } from "../auth/requireAuth";
import { listStandaloneReminders } from "../services/reminderService";

// Standalone reminders have no parent entity to live under, so they get
// their own dashboard view (docs/04-workflows.md).
export const remindersRouter = Router();
remindersRouter.use(requireAuth);

remindersRouter.get("/", async (_req, res) => {
  res.status(200).json(await listStandaloneReminders());
});
