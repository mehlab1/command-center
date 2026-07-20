import { Router } from "express";
import { requireAuth } from "../auth/requireAuth";
import { listDevs } from "../services/devService";
import { listPods } from "../services/podService";
import { listProjectsWithTaskCounts } from "../services/projectService";
import { listTasks } from "../services/taskService";

// Read endpoints backing list/board views and the Phase 4 dashboard.
export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

entitiesRouter.get("/devs", async (_req, res) => {
  res.status(200).json(await listDevs());
});

entitiesRouter.get("/pods", async (_req, res) => {
  res.status(200).json(await listPods());
});

entitiesRouter.get("/projects", async (_req, res) => {
  res.status(200).json(await listProjectsWithTaskCounts());
});

entitiesRouter.get("/tasks", async (_req, res) => {
  res.status(200).json(await listTasks());
});
