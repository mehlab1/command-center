const taskFindMany = jest.fn();
const projectFindMany = jest.fn();
const notificationLogFindUnique = jest.fn();
const notificationLogCreate = jest.fn();
const settingFindUnique = jest.fn();
const devCount = jest.fn();
const devFindMany = jest.fn();
const qaQueueEntryCount = jest.fn();
const qaQueueEntryFindMany = jest.fn();

jest.mock("../lib/prisma", () => ({
  prisma: {
    task: { findMany: (...a: unknown[]) => taskFindMany(...a), count: jest.fn().mockResolvedValue(0) },
    project: { findMany: (...a: unknown[]) => projectFindMany(...a), count: jest.fn().mockResolvedValue(0) },
    notificationLog: {
      findUnique: (...a: unknown[]) => notificationLogFindUnique(...a),
      create: (...a: unknown[]) => notificationLogCreate(...a),
    },
    setting: { findUnique: (...a: unknown[]) => settingFindUnique(...a) },
    dev: { count: (...a: unknown[]) => devCount(...a), findMany: (...a: unknown[]) => devFindMany(...a) },
    qaQueueEntry: {
      count: (...a: unknown[]) => qaQueueEntryCount(...a),
      findMany: (...a: unknown[]) => qaQueueEntryFindMany(...a),
    },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error { code?: string } },
}));

const sendPushToAllDevices = jest.fn();
jest.mock("./pushService", () => ({ sendPushToAllDevices: (...a: unknown[]) => sendPushToAllDevices(...a) }));

const sendWhatsAppMessage = jest.fn();
jest.mock("../lib/greenApi", () => ({ sendWhatsAppMessage: (...a: unknown[]) => sendWhatsAppMessage(...a) }));

jest.mock("./reminderService", () => ({
  listDueOccurrences: jest.fn().mockResolvedValue([]),
  markOccurrenceSent: jest.fn(),
}));

import { runCronTick } from "./notificationService";

beforeEach(() => {
  // resetAllMocks (not just clearAllMocks) — several tests set custom
  // mockImplementation on sendPushToAllDevices/sendWhatsAppMessage, and a
  // plain clear leaves those implementations bleeding into later tests.
  jest.resetAllMocks();
  taskFindMany.mockResolvedValue([]);
  projectFindMany.mockResolvedValue([]);
  notificationLogFindUnique.mockResolvedValue(null);
  settingFindUnique.mockResolvedValue(null); // default digest time (08:00) applies, no WhatsApp target configured
  devCount.mockResolvedValue(0);
  devFindMany.mockResolvedValue([]);
  qaQueueEntryCount.mockResolvedValue(0);
  qaQueueEntryFindMany.mockResolvedValue([]);
  sendWhatsAppMessage.mockResolvedValue(undefined);
});

describe("runCronTick — deadline dedup ordering", () => {
  it("does not claim the notification slot if the push send fails, so the next tick can retry", async () => {
    const deadline = new Date(Date.now() - 1000); // already past at_deadline
    taskFindMany.mockResolvedValueOnce([{ id: "task-1", title: "Ship it", deadline, status: "TODO" }]);
    sendPushToAllDevices.mockRejectedValue(new Error("Firebase unreachable"));

    const summary = await runCronTick();

    expect(summary.taskDeadlinePushes).toBe(0);
    // The failed send must never have reached the claim step.
    expect(notificationLogCreate).not.toHaveBeenCalled();
  });

  it("claims the slot only after a successful send", async () => {
    const deadline = new Date(Date.now() - 1000);
    taskFindMany.mockResolvedValueOnce([{ id: "task-1", title: "Ship it", deadline, status: "TODO" }]);
    sendPushToAllDevices.mockResolvedValueOnce({ sent: 1, pruned: 0 });

    const summary = await runCronTick();

    expect(summary.taskDeadlinePushes).toBeGreaterThan(0);
    expect(notificationLogCreate).toHaveBeenCalled();
    // send must have happened before the claim was recorded.
    const sendOrder = sendPushToAllDevices.mock.invocationCallOrder[0];
    const claimOrder = notificationLogCreate.mock.invocationCallOrder[0];
    expect(sendOrder).toBeLessThan(claimOrder);
  });

  it("one task's send failure does not prevent other tasks/tiers from being checked", async () => {
    const deadline = new Date(Date.now() - 1000);
    taskFindMany.mockResolvedValueOnce([
      { id: "task-1", title: "Fails", deadline, status: "TODO" },
      { id: "task-2", title: "Succeeds", deadline, status: "TODO" },
    ]);
    sendPushToAllDevices.mockImplementation(async (payload: { body: string }) => {
      if (payload.body.includes("Fails")) throw new Error("transient");
      return { sent: 1, pruned: 0 };
    });

    const summary = await runCronTick();

    // task-1's 3 tiers all fail, task-2's 3 tiers all succeed.
    expect(summary.taskDeadlinePushes).toBe(3);
  });

  it("skips already-claimed tiers without attempting to send again", async () => {
    const deadline = new Date(Date.now() - 1000);
    taskFindMany.mockResolvedValueOnce([{ id: "task-1", title: "Ship it", deadline, status: "TODO" }]);
    notificationLogFindUnique.mockResolvedValue({ id: "log-1" }); // every tier already claimed

    const summary = await runCronTick();

    expect(summary.taskDeadlinePushes).toBe(0);
    expect(sendPushToAllDevices).not.toHaveBeenCalled();
  });
});

describe("runCronTick — category isolation", () => {
  it("a digest failure does not prevent task/project deadline checks from running", async () => {
    const deadline = new Date(Date.now() - 1000);
    taskFindMany.mockResolvedValueOnce([{ id: "task-1", title: "Ship it", deadline, status: "TODO" }]);
    sendPushToAllDevices.mockImplementation(async (payload: { title: string }) => {
      if (payload.title === "Daily digest") throw new Error("digest boom");
      return { sent: 1, pruned: 0 };
    });

    const summary = await runCronTick();

    expect(summary.digestSent).toBe(false);
    expect(summary.taskDeadlinePushes).toBeGreaterThan(0);
  });
});

describe("runCronTick — daily digest content & WhatsApp delivery", () => {
  function mockSettings(overrides: Record<string, string>) {
    settingFindUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const value = overrides[where.key];
      return value !== undefined ? { value } : null;
    });
  }

  it("sends push only when no WhatsApp target is configured", async () => {
    mockSettings({ daily_digest_time: "00:00" }); // always due, regardless of real clock

    const summary = await runCronTick();

    expect(summary.digestSent).toBe(true);
    expect(sendPushToAllDevices).toHaveBeenCalledWith(expect.objectContaining({ title: "Daily digest" }));
    expect(sendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("sends an itemized WhatsApp digest — personal tasks, due-within-24h, QA queue, unassigned devs/projects", async () => {
    mockSettings({
      daily_digest_time: "00:00",
      whatsapp_target_type: "number",
      whatsapp_number: "923001234567",
    });
    taskFindMany.mockResolvedValue([
      {
        id: "t1",
        title: "Finish deck",
        deadline: new Date(Date.now() + 60 * 60 * 1000),
        status: "TODO",
        isPersonal: true,
        assignees: [],
      },
    ]);
    qaQueueEntryFindMany.mockResolvedValue([{ task: { title: "Review PR" } }]);
    devFindMany.mockResolvedValue([{ name: "Aisha" }]);
    projectFindMany.mockResolvedValue([{ name: "Rebrand" }]);

    const summary = await runCronTick();

    expect(summary.digestSent).toBe(true);
    expect(sendWhatsAppMessage).toHaveBeenCalledWith("923001234567", expect.stringContaining("*Daily Digest"));
    const body = sendWhatsAppMessage.mock.calls[0][1] as string;
    expect(body).toContain("*Personal Tasks*");
    expect(body).toContain("Finish deck");
    expect(body).toContain("*Due within 24h*");
    expect(body).toContain("*QA Queue*");
    expect(body).toContain("Review PR");
    expect(body).toContain("*Unassigned Devs*");
    expect(body).toContain("Aisha");
    expect(body).toContain("*Unassigned Projects*");
    expect(body).toContain("Rebrand");
  });

  it("sends the WhatsApp digest to the group id when a group is the active target, even if a number is also stored", async () => {
    mockSettings({
      daily_digest_time: "00:00",
      whatsapp_target_type: "group",
      whatsapp_group_id: "12345@g.us",
      whatsapp_number: "923001234567",
    });

    await runCronTick();

    expect(sendWhatsAppMessage).toHaveBeenCalledWith("12345@g.us", expect.any(String));
  });

  it("a failed WhatsApp send does not prevent the push digest from being claimed", async () => {
    mockSettings({
      daily_digest_time: "00:00",
      whatsapp_target_type: "number",
      whatsapp_number: "923001234567",
    });
    sendWhatsAppMessage.mockRejectedValue(new Error("Green API down"));

    const summary = await runCronTick();

    expect(summary.digestSent).toBe(true);
    expect(sendPushToAllDevices).toHaveBeenCalledWith(expect.objectContaining({ title: "Daily digest" }));
  });
});
