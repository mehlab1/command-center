import { Router } from "express";
import { env } from "../config/env";
import { runCronTick } from "../services/notificationService";

// Machine-to-machine only — deliberately NOT behind requireAuth (session
// cookie auth doesn't make sense for cron-job.org's server-to-server ping).
// Authenticated instead via a bearer token shared with cron-job.org's own
// job configuration (docs/06-scheduling-and-notifications.md).
export const cronRouter = Router();

cronRouter.post("/tick", async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  // Empty CRON_SECRET must never authenticate — an unset env var should
  // deny every request, not accidentally match an empty header.
  if (!env.cronSecret || authHeader !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const summary = await runCronTick();
  res.status(200).json(summary);
});
