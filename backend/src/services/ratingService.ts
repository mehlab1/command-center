import { prisma } from "../lib/prisma";

export class NotRatableError extends Error {}

// After DONE (and PASSED QA if it required QA) — docs/04-workflows.md.
export async function assertRatable(taskId: string): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: { qaQueueEntry: true },
  });

  if (task.status !== "DONE") {
    throw new NotRatableError("This task isn't done yet.");
  }
  if (task.needsQa && task.qaQueueEntry?.status !== "PASSED") {
    throw new NotRatableError("This task needs QA to pass before it can be rated.");
  }
}

// Rating is written to tasks.rating (most recent rating given) AND inserted
// as a new ratings_history row (authoritative per-dev record, append-only —
// never updated) — docs/04-workflows.md.
export async function rateTask(taskId: string, devId: string, rating: number): Promise<void> {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { rating } }),
    prisma.ratingsHistory.create({
      data: {
        devId,
        taskId,
        rating,
        onTime: task.missedDeadline === false,
      },
    }),
  ]);
}
