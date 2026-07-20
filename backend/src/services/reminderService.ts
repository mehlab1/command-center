import { prisma } from "../lib/prisma";
import { ReminderChannel, ReminderOccurrenceStatus } from "@prisma/client";

export interface CreateReminderInput {
  message: string;
  linkedTaskId?: string;
  linkedProjectId?: string;
  channel: ReminderChannel;
  fireTimes: Date[];
}

export async function createReminder(input: CreateReminderInput) {
  return prisma.reminder.create({
    data: {
      message: input.message,
      linkedTaskId: input.linkedTaskId,
      linkedProjectId: input.linkedProjectId,
      channel: input.channel,
      occurrences: {
        create: input.fireTimes.map((fireTime) => ({ fireTime })),
      },
    },
    include: { occurrences: true },
  });
}

export async function listScheduledOccurrencesForTask(taskId: string) {
  return prisma.reminderOccurrence.findMany({
    where: {
      status: ReminderOccurrenceStatus.SCHEDULED,
      fireTime: { gt: new Date() },
      reminder: { linkedTaskId: taskId },
    },
    include: { reminder: true },
  });
}

// Cancels every still-SCHEDULED future occurrence of every reminder linked
// to this task — docs/04-workflows.md "cancel the reminders on that task".
export async function cancelRemindersForTask(taskId: string): Promise<number> {
  const result = await prisma.reminderOccurrence.updateMany({
    where: {
      status: ReminderOccurrenceStatus.SCHEDULED,
      reminder: { linkedTaskId: taskId },
    },
    data: { status: ReminderOccurrenceStatus.CANCELLED },
  });
  return result.count;
}

export async function cancelReminderById(reminderId: string): Promise<number> {
  const result = await prisma.reminderOccurrence.updateMany({
    where: { reminderId, status: ReminderOccurrenceStatus.SCHEDULED },
    data: { status: ReminderOccurrenceStatus.CANCELLED },
  });
  return result.count;
}

// Fuzzy free-text match against reminder message — reminders don't have a
// "name" the way other entities do, so this bypasses the generic
// resolveEntity/pg_trgm path and does a simple case-insensitive substring
// match, scoped to reminders with at least one still-SCHEDULED occurrence
// (a fully-fired/cancelled reminder isn't something you'd "cancel" again).
export async function findCancellableRemindersByQuery(query: string) {
  return prisma.reminder.findMany({
    where: {
      message: { contains: query, mode: "insensitive" },
      occurrences: { some: { status: ReminderOccurrenceStatus.SCHEDULED } },
    },
    include: { occurrences: true },
  });
}

export async function listStandaloneReminders() {
  return prisma.reminder.findMany({
    where: { linkedTaskId: null, linkedProjectId: null },
    include: { occurrences: { orderBy: { fireTime: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listDueOccurrences(now: Date) {
  return prisma.reminderOccurrence.findMany({
    where: { status: ReminderOccurrenceStatus.SCHEDULED, fireTime: { lte: now } },
    include: {
      reminder: { include: { linkedTask: true, linkedProject: true } },
    },
  });
}

export async function markOccurrenceSent(id: string): Promise<void> {
  await prisma.reminderOccurrence.update({ where: { id }, data: { status: ReminderOccurrenceStatus.SENT } });
}
