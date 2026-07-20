import { Router } from "express";
import { requireAuth } from "../auth/requireAuth";
import { listDevs } from "../services/devService";
import { listPods } from "../services/podService";
import { listProjects } from "../services/projectService";
import { listTasks } from "../services/taskService";

// Minimal read endpoints — just enough to verify agent behavior end to end
// and to back simple list/board views. Full CRUD UI is Phase 4.
export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

entitiesRouter.get("/devs", async (_req, res) => {
  res.status(200).json(await listDevs());
});

entitiesRouter.get("/pods", async (_req, res) => {
  res.status(200).json(await listPods());
});

entitiesRouter.get("/projects", async (_req, res) => {
  res.status(200).json(await listProjects());
});

entitiesRouter.get("/tasks", async (_req, res) => {
  res.status(200).json(await listTasks());
});
