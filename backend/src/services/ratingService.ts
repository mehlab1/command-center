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

export interface DevPerformance {
  devId: string;
  devName: string;
  avgRating: number | null;
  onTimePercent: number | null;
  history: { rating: number; onTime: boolean; createdAt: Date; taskTitle: string }[];
}

// Dashboard Performance panel (docs/phases/phase-4-dashboard.md task 6).
export async function getPerformanceSummary(): Promise<DevPerformance[]> {
  const devs = await prisma.dev.findMany({
    orderBy: { name: "asc" },
    include: {
      ratingsHistory: {
        orderBy: { createdAt: "asc" },
        include: { task: { select: { title: true } } },
      },
    },
  });

  return devs.map((dev) => {
    const history = dev.ratingsHistory.map((r) => ({
      rating: r.rating,
      onTime: r.onTime,
      createdAt: r.createdAt,
      taskTitle: r.task.title,
    }));
    const avgRating =
      history.length > 0 ? history.reduce((sum, h) => sum + h.rating, 0) / history.length : null;
    const onTimePercent =
      history.length > 0 ? (history.filter((h) => h.onTime).length / history.length) * 100 : null;

    return { devId: dev.id, devName: dev.name, avgRating, onTimePercent, history };
  });
}
