import { Prisma, TaskStatus, ProjectStatus, QaStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushToAllDevices } from "./pushService";
import { sendWhatsAppMessage } from "../lib/greenApi";
import { getDailyDigestTime, getWhatsAppTarget, getDigestPushEnabled, getDigestWhatsAppEnabled } from "./settingsService";
import { formatDeadline } from "../lib/dateFormat";
import { SELF_DEV_NAME } from "./devService";
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

interface DigestTask {
  title: string;
  deadline: Date;
  who: string | null; // dev name, "personal", or null (unassigned team task)
}

interface DigestData {
  overdue: DigestTask[];
  personalTasks: DigestTask[];
  dueWithin24h: DigestTask[];
  qaQueue: string[];
  unassignedDevs: string[];
  unassignedProjects: string[];
}

// Overdue (any open task past its deadline, personal or not — surfaced
// separately, at the top, so nothing slips by) is gathered independently
// from "Personal Tasks" and "Due within 24h", which then only cover
// still-on-time work, so nothing is ever listed twice across sections.
async function gatherDigestData(now: Date): Promise<DigestData> {
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const taskSelect = {
    title: true,
    deadline: true,
    isPersonal: true,
    assignees: { select: { dev: { select: { name: true } } } },
  } as const;

  const [overdueTasks, personalTasks, dueSoonTasks, qaEntries, unassignedDevs, activeProjects] = await Promise.all([
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE }, deadline: { lt: now } },
      orderBy: { deadline: "asc" },
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE }, isPersonal: true, deadline: { gte: now } },
      orderBy: { deadline: "asc" },
      select: { title: true, deadline: true },
    }),
    prisma.task.findMany({
      where: { status: { not: TaskStatus.DONE }, isPersonal: false, deadline: { gte: now, lt: in24h } },
      orderBy: { deadline: "asc" },
      select: { title: true, deadline: true, assignees: { select: { dev: { select: { name: true } } } } },
    }),
    prisma.qaQueueEntry.findMany({
      where: { status: QaStatus.UNASSIGNED },
      select: { task: { select: { title: true } } },
    }),
    // Mehlab is exempt from "no open task" style alerts elsewhere in the app
    // (his own work is tracked as personal tasks, not assignments) — same
    // exemption applies here so he doesn't see himself listed every day. An
    // "unassigned" dev is one with zero currently-OPEN assigned tasks, not
    // zero task history — a dev whose only tasks are already DONE must still
    // count as unassigned, matching the devs page's idle-glow definition.
    prisma.dev.findMany({
      where: { taskAssignees: { none: { task: { status: { not: TaskStatus.DONE } } } }, name: { not: SELF_DEV_NAME } },
      select: { name: true },
    }),
    // Matches the dashboard/projects-page "needs attention" definition
    // (projectService.ts): an ACTIVE project with either no tasks at all, or
    // no task that has a dev assignee (personal-only tasks don't count —
    // that's still nobody on the team actively working it).
    prisma.project.findMany({
      where: { status: ProjectStatus.ACTIVE },
      select: { name: true, tasks: { select: { assignees: { select: { devId: true } } } } },
    }),
  ]);

  const unassignedProjects = activeProjects.filter(
    (p) => p.tasks.length === 0 || p.tasks.every((t) => t.assignees.length === 0)
  );

  return {
    overdue: overdueTasks.map((t) => ({
      title: t.title,
      deadline: t.deadline,
      who: t.isPersonal ? "personal" : (t.assignees[0]?.dev.name ?? null),
    })),
    personalTasks: personalTasks.map((t) => ({ title: t.title, deadline: t.deadline, who: null })),
    dueWithin24h: dueSoonTasks.map((t) => ({
      title: t.title,
      deadline: t.deadline,
      who: t.assignees[0]?.dev.name ?? null,
    })),
    qaQueue: qaEntries.map((q) => q.task.title),
    unassignedDevs: unassignedDevs.map((d) => d.name),
    unassignedProjects: unassignedProjects.map((p) => p.name),
  };
}

// Push notification bodies are meant to be glanceable, not itemized — a
// one-line count summary that deep-links into the dashboard for detail.
function formatPushSummary(data: DigestData): string {
  return [
    `Overdue: ${data.overdue.length}`,
    `Personal: ${data.personalTasks.length}`,
    `Due within 24h: ${data.dueWithin24h.length}`,
    `QA queue: ${data.qaQueue.length}`,
    `Unassigned devs: ${data.unassignedDevs.length}`,
    `Unassigned projects: ${data.unassignedProjects.length}`,
  ].join(" · ");
}

function formatTaskLine(t: DigestTask): string {
  const who = t.who ? ` — ${t.who}` : "";
  return `- ${t.title}${who} (${formatDeadline(t.deadline)})`;
}

function formatSection(title: string, lines: string[]): string {
  return [`*${title}*`, lines.length > 0 ? lines.join("\n") : "- none"].join("\n");
}

// Full itemized version for WhatsApp — the digest's primary readable form,
// per the app's chat-first design. WhatsApp renders *text* as bold. Overdue
// leads so it's the first thing seen.
function formatWhatsAppDigest(data: DigestData, dateKey: string): string {
  return [
    `*Daily Digest — ${dateKey}*`,
    formatSection("Overdue", data.overdue.map(formatTaskLine)),
    formatSection("Personal Tasks", data.personalTasks.map(formatTaskLine)),
    formatSection("Due within 24h", data.dueWithin24h.map(formatTaskLine)),
    formatSection("QA Queue", data.qaQueue.map((title) => `- ${title}`)),
    formatSection("Unassigned Devs", data.unassignedDevs.map((name) => `- ${name}`)),
    formatSection("Unassigned Projects", data.unassignedProjects.map((name) => `- ${name}`)),
  ].join("\n\n");
}

async function checkDailyDigest(now: Date): Promise<boolean> {
  const digestTime = await getDailyDigestTime(); // "HH:mm"
  if (currentHHmm(now) < digestTime) return false;

  const dateKey = todayDateKey(now);
  if (await alreadyClaimed("digest", "daily", dateKey)) return false;

  const [pushEnabled, whatsappEnabled] = await Promise.all([getDigestPushEnabled(), getDigestWhatsAppEnabled()]);
  if (!pushEnabled && !whatsappEnabled) return false; // "none" selected — nothing to send or claim

  try {
    const data = await gatherDigestData(now);

    if (pushEnabled) {
      await sendPushToAllDevices({ title: "Daily digest", body: formatPushSummary(data), url: "/dashboard" });
    }

    if (whatsappEnabled) {
      const target = await getWhatsAppTarget();
      if (target) {
        try {
          await sendWhatsAppMessage(target, formatWhatsAppDigest(data, dateKey));
        } catch (err) {
          // The push digest (if enabled) already went out — a WhatsApp
          // delivery failure must not un-send that, and must not block the
          // claim below (that would retry the whole digest next tick and
          // double-send the push).
          console.error("Failed to send WhatsApp daily digest:", err);
        }
      }
    }
  } catch (err) {
    console.error("Failed to compose/send daily digest:", err);
    return false;
  }

  return tryClaim("digest", "daily", dateKey);
}

// Manual trigger (Settings page "send a test digest") — sends the current
// digest content over WhatsApp right now, bypassing the scheduled-time check
// and the once-per-day dedup claim, so verifying a WhatsApp target actually
// works doesn't require waiting for the real digest time or burning that
// day's real send. Still respects the WhatsApp on/off toggle — if Mehlab has
// turned WhatsApp digest delivery off, a "test" send shouldn't go out anyway.
export async function sendTestDigest(): Promise<{ sent: boolean; target: string | null }> {
  const whatsappEnabled = await getDigestWhatsAppEnabled();
  if (!whatsappEnabled) return { sent: false, target: null };

  const target = await getWhatsAppTarget();
  if (!target) return { sent: false, target: null };

  const now = new Date();
  const data = await gatherDigestData(now);
  await sendWhatsAppMessage(target, formatWhatsAppDigest(data, todayDateKey(now)));
  return { sent: true, target };
}

async function checkReminderOccurrences(now: Date): Promise<number> {
  const due = await reminderService.listDueOccurrences(now);
  let sent = 0;
  for (const occurrence of due) {
    const { reminder } = occurrence;
    const body = reminder.message;
    try {
      if (reminder.channel === "WHATSAPP") {
        const target = await getWhatsAppTarget();
        if (target) {
          await sendWhatsAppMessage(target, body);
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
