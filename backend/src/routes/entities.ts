import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth";
import { AuditActionType, AuditSource } from "@prisma/client";
import { recordAudit } from "../services/auditService";
import { sendPushToAllDevices } from "../services/pushService";
import * as reminderService from "../services/reminderService";
import * as qaService from "../services/qaService";
import * as devService from "../services/devService";
import * as podService from "../services/podService";
import * as projectService from "../services/projectService";
import * as taskService from "../services/taskService";

// Read endpoints backing list/board views and the Phase 4 dashboard, plus
// direct (non-chat) create/edit/delete for manual UI actions — every write
// here goes through the exact same service-layer functions the chat agent
// uses, logged with source: DASHBOARD instead of CHAT. A manual form
// submission with an explicit "Create"/"Save" tap is already the user's
// confirmation, so unlike chat there's no separate propose-then-confirm
// step here — only destructive deletes get a dedicated safety check.
export const entitiesRouter = Router();
entitiesRouter.use(requireAuth);

entitiesRouter.get("/devs", async (_req, res) => {
  res.status(200).json(await devService.listDevs());
});

entitiesRouter.get("/pods", async (_req, res) => {
  res.status(200).json(await podService.listPods());
});

entitiesRouter.get("/projects", async (_req, res) => {
  res.status(200).json(await projectService.listProjectsWithTaskCounts());
});

entitiesRouter.get("/tasks", async (_req, res) => {
  res.status(200).json(await taskService.listTasks());
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  deadline: z.string().optional(),
});

entitiesRouter.post("/projects", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const project = await projectService.createProject({
    name: parsed.data.name,
    description: parsed.data.description,
    category: parsed.data.category,
    deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
  });
  await recordAudit({
    actionType: AuditActionType.CREATE,
    entityType: "project",
    entityId: project.id,
    summary: `Create project "${project.name}".`,
    source: AuditSource.DASHBOARD,
  });
  res.status(201).json(project);
});

const editProjectSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  deadline: z.string().nullable().optional(),
});

entitiesRouter.patch("/projects/:id", async (req, res) => {
  const parsed = editProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const before = await projectService.getProjectById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const project = await projectService.editProject(req.params.id, {
    name: parsed.data.name,
    description: parsed.data.description,
    category: parsed.data.category,
    status: parsed.data.status,
    deadline: parsed.data.deadline === undefined ? undefined : parsed.data.deadline ? new Date(parsed.data.deadline) : null,
  });
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "project",
    entityId: project.id,
    summary: `Edit project "${project.name}".`,
    diff: { before, after: project },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(project);
});

entitiesRouter.delete("/projects/:id", async (req, res) => {
  const cascadeTasks = req.query.cascadeTasks === "true";
  const project = await projectService.getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await projectService.deleteProject(req.params.id, cascadeTasks);
  await recordAudit({
    actionType: AuditActionType.DELETE,
    entityType: "project",
    entityId: req.params.id,
    summary: `Delete project "${project.name}"${cascadeTasks ? " and its tasks" : ""}.`,
    diff: { before: project },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Devs
// ---------------------------------------------------------------------------

const createDevSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "INTERN"]),
  internshipEndDate: z.string().optional(),
});

entitiesRouter.post("/devs", async (req, res) => {
  const parsed = createDevSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "name and employmentType are required" });
    return;
  }
  const dev = await devService.createDev({
    name: parsed.data.name,
    designation: parsed.data.designation,
    employmentType: parsed.data.employmentType,
    internshipEndDate: parsed.data.internshipEndDate ? new Date(parsed.data.internshipEndDate) : undefined,
  });
  await recordAudit({
    actionType: AuditActionType.CREATE,
    entityType: "dev",
    entityId: dev.id,
    summary: `Add dev "${dev.name}" (${dev.employmentType}).`,
    source: AuditSource.DASHBOARD,
  });
  res.status(201).json(dev);
});

const editDevSchema = z.object({
  name: z.string().optional(),
  designation: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "INTERN"]).optional(),
  internshipEndDate: z.string().nullable().optional(),
});

entitiesRouter.patch("/devs/:id", async (req, res) => {
  const parsed = editDevSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const before = await devService.getDevById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Dev not found" });
    return;
  }
  const dev = await devService.editDev(req.params.id, {
    name: parsed.data.name,
    designation: parsed.data.designation,
    employmentType: parsed.data.employmentType,
    internshipEndDate:
      parsed.data.internshipEndDate === undefined
        ? undefined
        : parsed.data.internshipEndDate
          ? new Date(parsed.data.internshipEndDate)
          : null,
  });
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "dev",
    entityId: dev.id,
    summary: `Edit dev "${dev.name}".`,
    diff: { before, after: dev },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(dev);
});

entitiesRouter.patch("/devs/:id/pod", async (req, res) => {
  const podId = req.body?.podId as string | undefined;
  if (!podId) {
    res.status(400).json({ error: "podId is required" });
    return;
  }
  const before = await devService.getDevById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Dev not found" });
    return;
  }
  const dev = await devService.reassignDevPod(req.params.id, podId);
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "dev",
    entityId: dev.id,
    summary: `Move dev "${dev.name}" to a different pod.`,
    diff: { before, after: dev },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(dev);
});

entitiesRouter.delete("/devs/:id", async (req, res) => {
  const acknowledgedOpenTasks = req.query.acknowledgedOpenTasks === "true";
  const dev = await devService.getDevById(req.params.id);
  if (!dev) {
    res.status(404).json({ error: "Dev not found" });
    return;
  }
  const check = await devService.checkDeleteDev(req.params.id);
  if (check.ledPodNames.length > 0) {
    res.status(409).json({
      error: `"${dev.name}" leads ${check.ledPodNames.join(", ")} — reassign the lead first.`,
    });
    return;
  }
  if (check.ratingsHistoryCount > 0) {
    res.status(409).json({
      error: `"${dev.name}" has ${check.ratingsHistoryCount} rating(s) on record — this needs a manual decision, not a casual delete.`,
    });
    return;
  }
  if (check.openTaskCount > 0 && !acknowledgedOpenTasks) {
    res.status(409).json({
      error: `"${dev.name}" has ${check.openTaskCount} open task(s) assigned.`,
      requiresAcknowledgement: true,
      openTaskCount: check.openTaskCount,
    });
    return;
  }
  await devService.deleteDev(req.params.id);
  await recordAudit({
    actionType: AuditActionType.DELETE,
    entityType: "dev",
    entityId: req.params.id,
    summary: `Delete dev "${dev.name}".`,
    diff: { before: dev },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Pods
// ---------------------------------------------------------------------------

const createPodSchema = z.object({ name: z.string().min(1), leadDevId: z.string().min(1) });

entitiesRouter.post("/pods", async (req, res) => {
  const parsed = createPodSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "name and leadDevId are required" });
    return;
  }
  const pod = await podService.createPod(parsed.data);
  await recordAudit({
    actionType: AuditActionType.CREATE,
    entityType: "pod",
    entityId: pod.id,
    summary: `Create pod "${pod.name}".`,
    source: AuditSource.DASHBOARD,
  });
  res.status(201).json(pod);
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().optional(),
  isPersonal: z.boolean(),
  deadline: z.string().min(1),
  needsQa: z.boolean(),
  assigneeDevIds: z.array(z.string()).optional(),
});

entitiesRouter.post("/tasks", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "title and deadline are required" });
    return;
  }
  if (!parsed.data.isPersonal && (!parsed.data.assigneeDevIds || parsed.data.assigneeDevIds.length === 0)) {
    res.status(400).json({ error: "Either mark this task personal or assign at least one dev" });
    return;
  }
  const task = await taskService.createTask({
    title: parsed.data.title,
    description: parsed.data.description,
    notes: parsed.data.notes,
    projectId: parsed.data.projectId,
    isPersonal: parsed.data.isPersonal,
    deadline: new Date(parsed.data.deadline),
    needsQa: parsed.data.needsQa,
    assigneeDevIds: parsed.data.assigneeDevIds ?? [],
  });
  await taskService.linkPendingSupersessionIfAny(task.id);
  await recordAudit({
    actionType: AuditActionType.CREATE,
    entityType: "task",
    entityId: task.id,
    summary: `Create task "${task.title}".`,
    source: AuditSource.DASHBOARD,
  });
  res.status(201).json(task);
});

const editTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  deadline: z.string().optional(),
  assigneeDevIds: z.array(z.string()).optional(),
});

// In-place edit — the task keeps its id, so QA state, ratings, and any
// blocked/missed-deadline history survive untouched. Only the fields
// actually sent are changed.
entitiesRouter.patch("/tasks/:id", async (req, res) => {
  const parsed = editTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const before = await taskService.getTaskById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (before.isPersonal && parsed.data.assigneeDevIds && parsed.data.assigneeDevIds.length > 0) {
    res.status(400).json({ error: "A personal task can't be assigned to a dev." });
    return;
  }
  const task = await taskService.editTask(req.params.id, {
    title: parsed.data.title,
    description: parsed.data.description,
    notes: parsed.data.notes,
    projectId: parsed.data.projectId,
    deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    assigneeDevIds: parsed.data.assigneeDevIds,
  });
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "task",
    entityId: task.id,
    summary: `Edit task "${task.title}".`,
    diff: { before, after: task },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(task);
});

entitiesRouter.delete("/tasks/:id", async (req, res) => {
  const before = await taskService.getTaskById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await taskService.deleteTask(req.params.id);
  await recordAudit({
    actionType: AuditActionType.DELETE,
    entityType: "task",
    entityId: req.params.id,
    summary: `Delete task "${before.title}".`,
    diff: { before },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json({ ok: true });
});

const markDoneSchema = z.object({
  missedDeadline: z.boolean(),
  cancelReminders: z.boolean().optional(),
});

entitiesRouter.post("/tasks/:id/done", async (req, res) => {
  const parsed = markDoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "missedDeadline is required" });
    return;
  }
  const before = await taskService.getTaskById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const task = await taskService.markTaskDone(req.params.id, parsed.data.missedDeadline);

  if (task.needsQa) {
    await qaService.createQaEntryForTask(task.id);
    await sendPushToAllDevices({ title: "QA review needed", body: `"${task.title}" is ready for QA.`, url: "/dashboard" });
  }
  if (parsed.data.cancelReminders) {
    await reminderService.cancelRemindersForTask(req.params.id);
  }

  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "task",
    entityId: task.id,
    summary: `Mark "${task.title}" done${parsed.data.missedDeadline ? " (missed deadline)" : ""}.`,
    diff: { before, after: task },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(task);
});

const markBlockedSchema = z.object({
  blockerDescription: z.string().min(1),
  revisedDeadline: z.string().min(1),
});

entitiesRouter.post("/tasks/:id/blocked", async (req, res) => {
  const parsed = markBlockedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "blockerDescription and revisedDeadline are both required" });
    return;
  }
  const before = await taskService.getTaskById(req.params.id);
  if (!before) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const task = await taskService.markTaskBlocked(
    req.params.id,
    parsed.data.blockerDescription,
    new Date(parsed.data.revisedDeadline)
  );
  await sendPushToAllDevices({
    title: "Task blocked",
    body: `"${task.title}" is blocked: ${parsed.data.blockerDescription}`,
    url: "/tasks",
  });
  await recordAudit({
    actionType: AuditActionType.EDIT,
    entityType: "task",
    entityId: task.id,
    summary: `Mark "${task.title}" blocked: ${parsed.data.blockerDescription}.`,
    diff: { before, after: task },
    source: AuditSource.DASHBOARD,
  });
  res.status(200).json(task);
});
