import { prisma } from "../lib/prisma";
import { Dev, EmploymentType, TaskStatus } from "@prisma/client";

export interface DevWithComputed extends Dev {
  isLead: boolean;
  isAssigned: boolean;
  openTaskCount: number;
}

// Per docs/01-data-model.md: lead status and assigned status are NEVER
// stored columns — always computed at query time.
export async function isDevLead(devId: string): Promise<boolean> {
  const count = await prisma.pod.count({ where: { leadDevId: devId } });
  return count > 0;
}

// Mehlab's own dev row — his personal tasks (isPersonal=true) are never
// linked via TaskAssignee at all (there's no one else to assign them to),
// so they'd otherwise never count as "his" anywhere. Folded in here by name
// since this app models exactly one CTO and always will.
export const SELF_DEV_NAME = "Mehlab";

export async function getOpenTaskCount(dev: Pick<Dev, "id" | "name">): Promise<number> {
  const assigned = await prisma.task.count({
    where: { status: { not: TaskStatus.DONE }, assignees: { some: { devId: dev.id } } },
  });
  if (dev.name !== SELF_DEV_NAME) return assigned;
  const personal = await prisma.task.count({ where: { status: { not: TaskStatus.DONE }, isPersonal: true } });
  return assigned + personal;
}

export async function withComputed(dev: Dev): Promise<DevWithComputed> {
  const [isLead, openTaskCount] = await Promise.all([isDevLead(dev.id), getOpenTaskCount(dev)]);
  return { ...dev, isLead, isAssigned: openTaskCount > 0, openTaskCount };
}

export async function listDevs(): Promise<DevWithComputed[]> {
  const devs = await prisma.dev.findMany({ orderBy: { name: "asc" } });
  return Promise.all(devs.map(withComputed));
}

export async function getDevById(id: string): Promise<DevWithComputed | null> {
  const dev = await prisma.dev.findUnique({ where: { id } });
  return dev ? withComputed(dev) : null;
}

export async function createDev(input: {
  name: string;
  designation?: string;
  employmentType: EmploymentType;
  internshipEndDate?: Date;
}): Promise<Dev> {
  return prisma.dev.create({ data: input });
}

export async function editDev(
  id: string,
  input: Partial<{
    name: string;
    designation: string;
    employmentType: EmploymentType;
    internshipEndDate: Date | null;
  }>
): Promise<Dev> {
  return prisma.dev.update({ where: { id }, data: input });
}

export interface DeleteDevCheck {
  openTaskCount: number;
  ratingsHistoryCount: number;
  ledPodNames: string[];
}

// Surfaces every reason deletion could fail as a clear message instead of a
// raw FK constraint error — leadDevId is required (a pod always has exactly
// one lead) and ratings_history.dev_id intentionally has no onDelete:Cascade
// (see schema.prisma), so both would otherwise throw at the DB layer.
export async function checkDeleteDev(id: string): Promise<DeleteDevCheck> {
  const [openTaskCount, ratingsHistoryCount, ledPods] = await Promise.all([
    prisma.task.count({
      where: { status: { not: TaskStatus.DONE }, assignees: { some: { devId: id } } },
    }),
    prisma.ratingsHistory.count({ where: { devId: id } }),
    prisma.pod.findMany({ where: { leadDevId: id }, select: { name: true } }),
  ]);
  return { openTaskCount, ratingsHistoryCount, ledPodNames: ledPods.map((p) => p.name) };
}

export async function deleteDev(id: string): Promise<Dev> {
  return prisma.dev.delete({ where: { id } });
}

export async function reassignDevPod(devId: string, podId: string): Promise<Dev> {
  return prisma.dev.update({ where: { id: devId }, data: { podId } });
}
