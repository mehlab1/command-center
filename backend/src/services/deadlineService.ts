import { prisma } from "../lib/prisma";
import { TaskStatus } from "@prisma/client";

// Shared by the dashboard (Phase 4) and the cron tick handler (Phase 6) —
// "don't duplicate the what's-due-soon logic" per docs/phases/phase-4-dashboard.md.
export interface DeadlineRadarItem {
  kind: "task" | "project";
  id: string;
  title: string;
  deadline: Date;
}

export interface DeadlineRadar {
  overdue: DeadlineRadarItem[];
  dueWithin1h: DeadlineRadarItem[];
  dueWithin24h: DeadlineRadarItem[];
}

export async function getDeadlineRadar(now: Date = new Date()): Promise<DeadlineRadar> {
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [openTasks, activeProjects] = await Promise.all([
    prisma.task.findMany({
      where: { status: { notIn: [TaskStatus.DONE] } },
      select: { id: true, title: true, deadline: true },
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE", deadline: { not: null } },
      select: { id: true, name: true, deadline: true },
    }),
  ]);

  const items: DeadlineRadarItem[] = [
    ...openTasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, deadline: t.deadline })),
    ...activeProjects.map((p) => ({ kind: "project" as const, id: p.id, title: p.name, deadline: p.deadline as Date })),
  ];

  const radar: DeadlineRadar = { overdue: [], dueWithin1h: [], dueWithin24h: [] };
  for (const item of items) {
    if (item.deadline < now) radar.overdue.push(item);
    else if (item.deadline <= in1h) radar.dueWithin1h.push(item);
    else if (item.deadline <= in24h) radar.dueWithin24h.push(item);
  }

  const byDeadline = (a: DeadlineRadarItem, b: DeadlineRadarItem) => a.deadline.getTime() - b.deadline.getTime();
  radar.overdue.sort(byDeadline);
  radar.dueWithin1h.sort(byDeadline);
  radar.dueWithin24h.sort(byDeadline);

  return radar;
}
