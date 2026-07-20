import { prisma } from "../lib/prisma";
import { Pod } from "@prisma/client";

export async function listPods() {
  return prisma.pod.findMany({ orderBy: { name: "asc" }, include: { members: true, lead: true } });
}

export async function getPodById(id: string) {
  return prisma.pod.findUnique({ where: { id }, include: { members: true, lead: true } });
}

// Pod.leadDevId is unique — a dev can only lead one pod at a time. Callers
// must check this before create_pod/reassign_pod_lead or the write throws a
// raw unique-constraint error instead of a clear message.
export async function getPodLedBy(devId: string): Promise<Pod | null> {
  return prisma.pod.findUnique({ where: { leadDevId: devId } });
}

// Lead is also kept as a member for roster-display consistency, per
// docs/01-data-model.md's recommendation.
export async function createPod(input: { name: string; leadDevId: string }): Promise<Pod> {
  return prisma.$transaction(async (tx) => {
    const pod = await tx.pod.create({ data: { name: input.name, leadDevId: input.leadDevId } });
    await tx.dev.update({ where: { id: input.leadDevId }, data: { podId: pod.id } });
    return pod;
  });
}

export async function editPod(id: string, input: Partial<{ name: string }>): Promise<Pod> {
  return prisma.pod.update({ where: { id }, data: input });
}

// Per docs/04-workflows.md: reassigning a pod's lead automatically demotes
// the old lead (computed — no manual "unset" step). If the old lead isn't
// given a new pod in the same action, they end up with podId = null.
export async function reassignPodLead(podId: string, newLeadDevId: string): Promise<Pod> {
  return prisma.$transaction(async (tx) => {
    const pod = await tx.pod.findUniqueOrThrow({ where: { id: podId } });
    const oldLeadDevId = pod.leadDevId;

    const updated = await tx.pod.update({
      where: { id: podId },
      data: { leadDevId: newLeadDevId },
    });

    await tx.dev.update({ where: { id: newLeadDevId }, data: { podId } });

    if (oldLeadDevId !== newLeadDevId) {
      await tx.dev.update({ where: { id: oldLeadDevId }, data: { podId: null } });
    }

    return updated;
  });
}
