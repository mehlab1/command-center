import { prisma } from "../lib/prisma";
import { Task } from "@prisma/client";

export async function listTasks() {
  return prisma.task.findMany({
    orderBy: { deadline: "asc" },
    include: { assignees: { include: { dev: true } }, project: true, qaQueueEntry: true },
  });
}

export async function getTaskById(id: string) {
  return prisma.task.findUnique({ where: { id }, include: { assignees: true, qaQueueEntry: true } });
}

// In-place edit — the task keeps its id, so QA history, ratings, audit
// entries, blockerDescription/missedDeadline, and reminders linked to it all
// stay intact. Only the fields actually passed are touched; assigneeDevIds,
// when present, replaces the assignee set atomically (never a delete+recreate
// of the task row itself).
export async function editTask(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    notes: string | null;
    projectId: string | null;
    deadline: Date;
    assigneeDevIds: string[];
  }>
): Promise<Task> {
  const { assigneeDevIds, ...rest } = input;
  return prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(assigneeDevIds !== undefined
        ? { assignees: { deleteMany: {}, create: assigneeDevIds.map((devId) => ({ devId })) } }
        : {}),
    },
  });
}

export async function createTask(input: {
  title: string;
  description?: string;
  notes?: string;
  projectId?: string;
  isPersonal: boolean;
  deadline: Date;
  needsQa: boolean;
  assigneeDevIds: string[];
}): Promise<Task> {
  return prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      notes: input.notes,
      projectId: input.projectId,
      isPersonal: input.isPersonal,
      deadline: input.deadline,
      needsQa: input.needsQa,
      assignees: {
        create: input.assigneeDevIds.map((devId) => ({ devId })),
      },
    },
  });
}

export async function deleteTask(id: string): Promise<Task> {
  return prisma.task.delete({ where: { id } });
}

// Defense in depth per docs/04-workflows.md — enforced here, not just at the
// tool-schema level, so it can't be bypassed by an unusual LLM output.
export async function markTaskBlocked(
  id: string,
  blockerDescription: string | undefined,
  revisedDeadline: Date | undefined
): Promise<Task> {
  if (!blockerDescription || !revisedDeadline) {
    throw new Error("mark_task_blocked requires both blockerDescription and revisedDeadline");
  }
  return prisma.task.update({
    where: { id },
    data: { status: "BLOCKED", blockerDescription, revisedDeadline },
  });
}

export async function markTaskInProgress(id: string): Promise<Task> {
  return prisma.task.update({ where: { id }, data: { status: "IN_PROGRESS" } });
}

export async function markTaskDone(id: string, missedDeadline: boolean): Promise<Task> {
  return prisma.task.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date(), missedDeadline },
  });
}

// Consumes at most one pending QA send-back (docs/04-workflows.md) — called
// from every create_task execution, a no-op when nothing is pending. Keeps
// create_task's own code path identical whether or not a send-back is live.
export async function linkPendingSupersessionIfAny(newTaskId: string): Promise<void> {
  const pending = await prisma.pendingSupersession.findFirst({ orderBy: { createdAt: "desc" } });
  if (!pending) return;

  await prisma.$transaction([
    prisma.task.update({ where: { id: newTaskId }, data: { supersedesTaskId: pending.originalTaskId } }),
    prisma.task.update({ where: { id: pending.originalTaskId }, data: { supersededByTaskId: newTaskId } }),
    prisma.pendingSupersession.delete({ where: { id: pending.id } }),
  ]);
}
