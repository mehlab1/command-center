const resolveEntity = jest.fn();
jest.mock("./disambiguation", () => ({
  resolveEntity: (...args: unknown[]) => resolveEntity(...args),
}));

const listScheduledOccurrencesForTask = jest.fn();
const findCancellableRemindersByQuery = jest.fn();
jest.mock("../services/reminderService", () => ({
  listScheduledOccurrencesForTask: (...args: unknown[]) => listScheduledOccurrencesForTask(...args),
  findCancellableRemindersByQuery: (...args: unknown[]) => findCancellableRemindersByQuery(...args),
}));

jest.mock("../services/devService", () => ({ checkDeleteDev: jest.fn(), getDevById: jest.fn() }));
jest.mock("../services/projectService", () => ({ checkDeleteProject: jest.fn() }));
jest.mock("../services/taskService", () => ({ getTaskById: jest.fn() }));
jest.mock("../services/ratingService", () => ({
  assertRatable: jest.fn(),
  NotRatableError: class NotRatableError extends Error {},
}));
jest.mock("../services/vaultService", () => ({ getVaultItemById: jest.fn() }));
jest.mock("../lib/prisma", () => ({ prisma: { pendingClarification: {} } }));

import { prepareCreateReminder, prepareCancelReminder, prepareUpdateSetting } from "./writeHandlers";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("prepareCreateReminder", () => {
  it("requires a message for a standalone reminder", async () => {
    const result = await prepareCreateReminder({ fire_time: "2026-08-01T10:00:00+05:00" });
    expect(result.status).toBe("need_field");
  });

  it("auto-generates a message for a linked reminder when none is given", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    const result = await prepareCreateReminder({ task_query: "Ship the thing", fire_time: "2026-08-01T10:00:00+05:00" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.message).toContain("Ship the thing");
      expect(result.resolvedArgs.linkedTaskId).toBe("task-1");
    }
  });

  it("asks for a time when none of the three fire-spec modes are given", async () => {
    const result = await prepareCreateReminder({ message: "Standalone reminder" });
    expect(result.status).toBe("need_field");
  });

  it("defaults to PUSH channel when unstated", async () => {
    const result = await prepareCreateReminder({ message: "Standalone reminder", fire_time: "2026-08-01T10:00:00+05:00" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.channel).toBe("PUSH");
    }
  });

  it("expands a recurring reminder into the correct number of evenly-spaced occurrences", async () => {
    const result = await prepareCreateReminder({
      message: "Take out the trash",
      fire_time: "2026-08-01T10:00:00+05:00",
      recurring_interval_days: 2,
      recurring_count: 5,
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      const fireTimes = result.resolvedArgs.fireTimes as string[];
      expect(fireTimes).toHaveLength(5);
      const gapDays = (new Date(fireTimes[1]).getTime() - new Date(fireTimes[0]).getTime()) / (24 * 60 * 60 * 1000);
      expect(gapDays).toBeCloseTo(2);
    }
  });

  it("uses an explicit fire_times list as-is when given", async () => {
    const times = ["2026-08-01T10:00:00+05:00", "2026-09-15T10:00:00+05:00"];
    const result = await prepareCreateReminder({ message: "Irregular reminder", fire_times: times });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.fireTimes).toHaveLength(2);
    }
  });
});

describe("prepareCancelReminder", () => {
  it("asks which reminder(s) when neither task_query nor reminder_query is given", async () => {
    const result = await prepareCancelReminder({});
    expect(result.status).toBe("need_field");
  });

  it("cancels every upcoming reminder on a resolved task", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    listScheduledOccurrencesForTask.mockResolvedValueOnce([{ id: "occ-1" }, { id: "occ-2" }]);

    const result = await prepareCancelReminder({ task_query: "Ship the thing" });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs).toEqual({ mode: "task", taskId: "task-1" });
      expect(result.summary).toContain("2");
    }
  });

  it("reports no upcoming reminders instead of a silent no-op", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    listScheduledOccurrencesForTask.mockResolvedValueOnce([]);

    const result = await prepareCancelReminder({ task_query: "Ship the thing" });

    expect(result.status).toBe("unresolved");
  });

  it("disambiguates when a free-text reminder query matches more than one", async () => {
    findCancellableRemindersByQuery.mockResolvedValueOnce([
      { id: "r1", message: "Submit the report" },
      { id: "r2", message: "Submit the report draft" },
    ]);

    const result = await prepareCancelReminder({ reminder_query: "submit the report" });

    expect(result.status).toBe("unresolved");
  });

  it("resolves a unique free-text reminder match", async () => {
    findCancellableRemindersByQuery.mockResolvedValueOnce([{ id: "r1", message: "Submit the report" }]);

    const result = await prepareCancelReminder({ reminder_query: "submit the report" });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs).toEqual({ mode: "reminder", reminderId: "r1" });
    }
  });
});

describe("prepareUpdateSetting", () => {
  it("validates daily_digest_time as 24-hour HH:mm", async () => {
    const bad = await prepareUpdateSetting({ key: "daily_digest_time", value: "8am" });
    expect(bad.status).toBe("need_field");

    const good = await prepareUpdateSetting({ key: "daily_digest_time", value: "08:00" });
    expect(good.status).toBe("ready");
  });

  it("validates whatsapp_number as a digits-only string of plausible length", async () => {
    const bad = await prepareUpdateSetting({ key: "whatsapp_number", value: "abc" });
    expect(bad.status).toBe("need_field");

    const good = await prepareUpdateSetting({ key: "whatsapp_number", value: "923001234567" });
    expect(good.status).toBe("ready");
  });
});
