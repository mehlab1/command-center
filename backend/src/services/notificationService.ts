import { Prisma, TaskStatus, ProjectStatus, QaStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushToAllDevices } from "./pushService";
import { sendWhatsAppMessage } from "../lib/greenApi";
import { getDailyDigestTime, getWhatsAppNumber } from "./settingsService";
import { formatDeadline } from "../lib/dateFormat";
import * as reminderService from "./reminderService";

const APP_TIMEZONE = "Asia/Karachi";

const DEADLINE_TIERS: { tier: string; offsetMs: number; label: string }[] = [
  { tier: "24h", offsetMs: 24 * 60 * 60 * 1000, label: "in 24 hours" },
  { tier: "1h", offsetMs: 60 * 60 * 1000, label: "in 1 hour" },
  { tier: "at_deadline", offsetMs: 0, label: "now" },
];

// Claims a (entity, tier) notification slot via the unique constraint on
// NotificationLog. Only ever called AFTER a send has already succeeded —
// claiming first and sending second would let a transient failure mid-send
// permanently burn that tier's dedup slot without the notification ever
// actually going out (found via live testing: a dropped DB connection
// during digest composition left that day's digest claimed-but-never-sent).
// The insert itself is still the dedup mechanism, so two overlapping ticks
// can't both count a send that only one of them actually performed.
async function tryClaim(entityType: string, entityId: string, tier: string): Promise<boolean> {
  try {
    await prisma.notificationLog.create({ data: { entityType, entityId, tier } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

// Checked BEFORE sending — this alone doesn't fully prevent a duplicate
// under concurrent ticks, but the tryClaim() after a successful send does.
// This pre-check just avoids an unnecessary send attempt on the common path.
async function alreadyClaimed(entityType: string, entityId: string, tier: string): Promise<boolean> {
  const existing = await prisma.notificationLog.findUnique({
    where: { entityType_entityId_tier: { entityType, entityId, tier } },
  });
  return existing !== null;
}

async function checkTaskDeadlines(now: Date): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: { status: { not: TaskStatus.DONE } },
  });

  let sent = 0;
  for (const task of tasks) {
    for (const { tier, offsetMs, label } of DEADLINE_TIERS) {
      const threshold = new Date(task.deadline.getTime() - offsetMs);
      if (now < threshold) continue;
      try {
        if (await alreadyClaimed("task", task.id, tier)) continue;
        await sendPushToAllDevices({
          title: "Task deadline",
          body: `"${task.title}" is due ${label === "now" ? "now" : label} (${formatDeadline(task.deadline)}).`,
          url: "/tasks",
        });
        if (await tryClaim("task", task.id, tier)) sent++;
      } catch (err) {
        // One task/tier's failure (e.g. a transient DB or Firebase error)
        // must not abort the whole tick — log and keep going so every other
        // task/project/reminder still gets checked this tick.
        console.error(`Failed task deadline notification (task ${task.id}, tier ${tier}):`, err);
      }
    }
  }
  return sent;
}

async function checkProjectDeadlines(now: Date): Promise<number> {
  const projects = await prisma.project.findMany({
    where: {
      deadline: { not: null },
      status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED] },
    },
  });

  let sent = 0;
  for (const project of projects) {
    if (!project.deadline) continue;
    for (const { tier, offsetMs, label } of DEADLINE_TIERS) {
      const threshold = new Date(project.deadline.getTime() - offsetMs);
      if (now < threshold) continue;
      try {
        if (await alreadyClaimed("project", project.id, tier)) continue;
        await sendPushToAllDevices({
          title: "Project deadline",
          body: `"${project.name}" is due ${label === "now" ? "now" : label} (${formatDeadline(project.deadline)}).`,
          url: "/dashboard",
        });
        if (await tryClaim("project", project.id, tier)) sent++;
      } catch (err) {
        console.error(`Failed project deadline notification (project ${project.id}, tier ${tier}):`, err);
      }
    }
  }
  return sent;
}

function todayDateKey(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }); // YYYY-MM-DD
}

function currentHHmm(now: Date): string {
  return now.toLocaleTimeString("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
}

async function composeDigest(): Promise<string> {
  const [dueToday, overdue, unassignedDevs, projectsNoTasks, unassignedQa] = await Promise.all([
    prisma.task.count({
      where: {
        status: { not: TaskStatus.DONE },
        deadline: { gte: startOfTodayKarachi(), lt: endOfTodayKarachi() },
      },
    }),
    prisma.task.count({ where: { status: { not: TaskStatus.DONE }, deadline: { lt: new Date() } } }),
    prisma.dev.count({ where: { taskAssignees: { none: {} } } }),
    prisma.project.count({ where: { tasks: { none: {} } } }),
    prisma.qaQueueEntry.count({ where: { status: QaStatus.UNASSIGNED } }),
  ]);

  const parts = [
    `Due today: ${dueToday}`,
    `Overdue: ${overdue}`,
    `Devs with no open task: ${unassignedDevs}`,
    `Projects with no tasks: ${projectsNoTasks}`,
    `Unassigned QA entries: ${unassignedQa}`,
  ];
  return parts.join(" · ");
}

function startOfTodayKarachi(): Date {
  const key = todayDateKey(new Date());
  return new Date(`${key}T00:00:00+05:00`);
}

function endOfTodayKarachi(): Date {
  const key = todayDateKey(new Date());
  return new Date(`${key}T23:59:59.999+05:00`);
}

async function checkDailyDigest(now: Date): Promise<boolean> {
  const digestTime = await getDailyDigestTime(); // "HH:mm"
  if (currentHHmm(now) < digestTime) return false;

  const dateKey = todayDateKey(now);
  if (await alreadyClaimed("digest", "daily", dateKey)) return false;

  try {
    const summary = await composeDigest();
    await sendPushToAllDevices({ title: "Daily digest", body: summary, url: "/dashboard" });
  } catch (err) {
    console.error("Failed to compose/send daily digest:", err);
    return false;
  }

  return tryClaim("digest", "daily", dateKey);
}

async function checkReminderOccurrences(now: Date): Promise<number> {
  const due = await reminderService.listDueOccurrences(now);
  let sent = 0;
  for (const occurrence of due) {
    const { reminder } = occurrence;
    const body = reminder.message;
    try {
      if (reminder.channel === "WHATSAPP") {
        const number = await getWhatsAppNumber();
        if (number) {
          await sendWhatsAppMessage(number, body);
        } else {
          // No number configured — fall back to push rather than silently
          // dropping the reminder entirely.
          await sendPushToAllDevices({ title: "Reminder", body, url: "/dashboard" });
        }
      } else {
        await sendPushToAllDevices({ title: "Reminder", body, url: "/dashboard" });
      }
      await reminderService.markOccurrenceSent(occurrence.id);
      sent++;
    } catch (err) {
      // Leave SCHEDULED so the next tick retries rather than silently
      // losing the reminder on a transient send failure.
      console.error(`Failed to send reminder occurrence ${occurrence.id}:`, err);
    }
  }
  return sent;
}

export interface CronTickSummary {
  taskDeadlinePushes: number;
  projectDeadlinePushes: number;
  digestSent: boolean;
  remindersSent: number;
}

// Each category is independent — a hard failure in one (e.g. reminders)
// must not prevent the others from running this tick, since cron-job.org
// only calls this endpoint once per interval and there's no separate retry
// for a category that got skipped because an unrelated one threw.
export async function runCronTick(): Promise<CronTickSummary> {
  const now = new Date();

  const taskDeadlinePushes = await checkTaskDeadlines(now).catch((err) => {
    console.error("checkTaskDeadlines failed:", err);
    return 0;
  });
  const projectDeadlinePushes = await checkProjectDeadlines(now).catch((err) => {
    console.error("checkProjectDeadlines failed:", err);
    return 0;
  });
  const digestSent = await checkDailyDigest(now).catch((err) => {
    console.error("checkDailyDigest failed:", err);
    return false;
  });
  const remindersSent = await checkReminderOccurrences(now).catch((err) => {
    console.error("checkReminderOccurrences failed:", err);
    return 0;
  });

  return { taskDeadlinePushes, projectDeadlinePushes, digestSent, remindersSent };
}
