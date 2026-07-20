import { prisma } from "../lib/prisma";
import { Dev, EmploymentType, TaskStatus } from "@prisma/client";

export interface DevWithComputed extends Dev {
  isLead: boolean;
  isAssigned: boolean;
}

// Per docs/01-data-model.md: lead status and assigned status are NEVER
// stored columns — always computed at query time.
export async function isDevLead(devId: string): Promise<boolean> {
  const count = await prisma.pod.count({ where: { leadDevId: devId } });
  return count > 0;
}

export async function isDevAssigned(devId: string): Promise<boolean> {
  const count = await prisma.task.count({
    where: { status: { not: TaskStatus.DONE }, assignees: { some: { devId } } },
  });
  return count > 0;
}

export async function withComputed(dev: Dev): Promise<DevWithComputed> {
  const [isLead, isAssigned] = await Promise.all([isDevLead(dev.id), isDevAssigned(dev.id)]);
  return { ...dev, isLead, isAssigned };
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
}

export async function checkDeleteDev(id: string): Promise<DeleteDevCheck> {
  const openTaskCount = await prisma.task.count({
    where: { status: { not: TaskStatus.DONE }, assignees: { some: { devId: id } } },
  });
  return { openTaskCount };
}

export async function deleteDev(id: string): Promise<Dev> {
  return prisma.dev.delete({ where: { id } });
}

export async function reassignDevPod(devId: string, podId: string): Promise<Dev> {
  return prisma.dev.update({ where: { id: devId }, data: { podId } });
}
