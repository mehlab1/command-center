import { prisma } from "../lib/prisma";
import { QaQueueEntry, QaStatus } from "@prisma/client";

// System-triggered, not user-invoked directly (docs/03-agent-and-llm.md) —
// called from inside markTaskDone's execution, never its own tool call.
export async function createQaEntryForTask(taskId: string): Promise<QaQueueEntry> {
  const defaultReviewerSetting = await prisma.setting.findUnique({
    where: { key: "default_qa_reviewer_dev_id" },
  });

  return prisma.qaQueueEntry.create({
    data: {
      taskId,
      status: QaStatus.UNASSIGNED,
      suggestedReviewerDevId: defaultReviewerSetting?.value ?? null,
    },
  });
}

export async function getQaEntryByTaskId(taskId: string) {
  return prisma.qaQueueEntry.findUnique({ where: { taskId } });
}

// Dashboard QA panel (docs/phases/phase-4-dashboard.md task 4).
export async function listQaQueueEntries() {
  return prisma.qaQueueEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      task: { select: { id: true, title: true, deadline: true } },
      suggestedReviewer: { select: { id: true, name: true } },
      assignedReviewer: { select: { id: true, name: true } },
    },
  });
}

// Suggestion only — assignment always requires this explicit call, never
// auto-commits (docs/04-workflows.md).
export async function assignQaReviewer(qaEntryId: string, reviewerDevId: string): Promise<QaQueueEntry> {
  return prisma.qaQueueEntry.update({
    where: { id: qaEntryId },
    data: { assignedReviewerDevId: reviewerDevId, status: QaStatus.ASSIGNED },
  });
}

export async function resolveQaEntryPassed(qaEntryId: string, outcomeNotes?: string): Promise<QaQueueEntry> {
  return prisma.qaQueueEntry.update({
    where: { id: qaEntryId },
    data: { status: QaStatus.PASSED, resolvedAt: new Date(), outcomeNotes },
  });
}

// Send-back: resolve the QA entry, and mark that the next create_task should
// link back to this original (docs/04-workflows.md "Sent Back" flow) —
// nothing else pre-fills, this is purely a traceability link.
export async function resolveQaEntrySentBack(
  qaEntryId: string,
  taskId: string,
  outcomeNotes?: string
): Promise<QaQueueEntry> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.qaQueueEntry.update({
      where: { id: qaEntryId },
      data: { status: QaStatus.SENT_BACK, resolvedAt: new Date(), outcomeNotes },
    });
    await tx.pendingSupersession.deleteMany({});
    await tx.pendingSupersession.create({ data: { originalTaskId: taskId } });
    return entry;
  });
}
