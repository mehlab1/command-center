const taskFindMany = jest.fn();
const projectFindMany = jest.fn();
const notificationLogFindUnique = jest.fn();
const notificationLogCreate = jest.fn();
const settingFindUnique = jest.fn();
const devCount = jest.fn();
const qaQueueEntryCount = jest.fn();

jest.mock("../lib/prisma", () => ({
  prisma: {
    task: { findMany: (...a: unknown[]) => taskFindMany(...a), count: jest.fn().mockResolvedValue(0) },
    project: { findMany: (...a: unknown[]) => projectFindMany(...a), count: jest.fn().mockResolvedValue(0) },
    notificationLog: {
      findUnique: (...a: unknown[]) => notificationLogFindUnique(...a),
      create: (...a: unknown[]) => notificationLogCreate(...a),
    },
    setting: { findUnique: (...a: unknown[]) => settingFindUnique(...a) },
    dev: { count: (...a: unknown[]) => devCount(...a) },
    qaQueueEntry: { count: (...a: unknown[]) => qaQueueEntryCount(...a) },
  },
  Prisma: { PrismaClientKnownRequestError: class extends Error { code?: string } },
}));

const sendPushToAllDevices = jest.fn();
jest.mock("./pushService", () => ({ sendPushToAllDevices: (...a: unknown[]) => sendPushToAllDevices(...a) }));

jest.mock("../lib/greenApi", () => ({ sendWhatsAppMessage: jest.fn() }));

jest.mock("./reminderService", () => ({
  listDueOccurrences: jest.fn().mockResolvedValue([]),
  markOccurrenceSent: jest.fn(),
}));

import { runCronTick } from "./notificationService";

beforeEach(() => {
  jest.clearAllMocks();
  taskFindMany.mockResolvedValue([]);
  projectFindMany.mockResolvedValue([]);
  notificationLogFindUnique.mockResolvedValue(null);
  settingFindUnique.mockResolvedValue(null); // default digest time (08:00) applies
  devCount.mockResolvedValue(0);
  qaQueueEntryCount.mockResolvedValue(0);
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
