import { Router } from "express";
import { requireAuth } from "../auth/requireAuth";
import { listQaQueueEntries } from "../services/qaService";
import { getDeadlineRadar } from "../services/deadlineService";
import { getPerformanceSummary } from "../services/ratingService";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/qa", async (_req, res) => {
  res.status(200).json(await listQaQueueEntries());
});

dashboardRouter.get("/deadlines", async (_req, res) => {
  res.status(200).json(await getDeadlineRadar());
});

dashboardRouter.get("/performance", async (_req, res) => {
  res.status(200).json(await getPerformanceSummary());
});
