const resolveEntity = jest.fn();
jest.mock("./disambiguation", () => ({
  resolveEntity: (...args: unknown[]) => resolveEntity(...args),
}));

const getTaskById = jest.fn();
jest.mock("../services/taskService", () => ({ getTaskById: (...args: unknown[]) => getTaskById(...args) }));

// devService/ratingService/projectService are pulled in transitively by
// writeHandlers.ts for other tools — stub them so this file only exercises
// prepareMarkTaskDone.
jest.mock("../services/devService", () => ({ checkDeleteDev: jest.fn(), getDevById: jest.fn() }));
jest.mock("../services/projectService", () => ({ checkDeleteProject: jest.fn() }));
jest.mock("../services/ratingService", () => ({
  assertRatable: jest.fn(),
  NotRatableError: class NotRatableError extends Error {},
}));

// PendingClarification state (schema.prisma) — models "did the system
// actually ask this, and hasn't gotten an answer yet" so a boolean the LLM
// supplies unprompted (pattern-matched from unrelated history) is ignored.
let clarificationRow: { id: string; taskId: string; field: string } | null = null;
const pendingClarification = {
  deleteMany: jest.fn(async () => {
    clarificationRow = null;
  }),
  create: jest.fn(async ({ data }: { data: { taskId: string; field: string } }) => {
    clarificationRow = { id: "clar-1", ...data };
    return clarificationRow;
  }),
  findFirst: jest.fn(async () => clarificationRow),
  delete: jest.fn(async () => {
    clarificationRow = null;
  }),
};
jest.mock("../lib/prisma", () => ({ prisma: { pendingClarification } }));

import { prepareMarkTaskDone } from "./writeHandlers";

function makeTask(deadline: Date) {
  return { id: "task-1", title: "Ship the thing", deadline };
}

beforeEach(() => {
  jest.clearAllMocks();
  clarificationRow = null;
});

// The exact four-branch hybrid logic in docs/04-workflows.md § Deadline-miss
// detection — each branch gets its own test per phase-3-tasks-and-qa.md.
describe("mark_task_done — deadline-miss hybrid logic", () => {
  it("branch 1: on-time — no question asked, missedDeadline set false directly", async () => {
    const future = new Date(Date.now() + 60_000);
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    getTaskById.mockResolvedValueOnce(makeTask(future));

    const result = await prepareMarkTaskDone({ task_query: "Ship the thing" });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.missedDeadline).toBe(false);
      expect(result.summary).toContain("on time");
    }
  });

  it("branch 2: late, no answer yet — asks the missed-deadline question instead of guessing", async () => {
    const past = new Date(Date.now() - 60_000);
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    getTaskById.mockResolvedValueOnce(makeTask(past));

    const result = await prepareMarkTaskDone({ task_query: "Ship the thing" });

    expect(result.status).toBe("need_field");
    if (result.status === "need_field") {
      expect(result.message).toMatch(/missed deadline/i);
    }
    expect(clarificationRow).toEqual({ id: "clar-1", taskId: "task-1", field: "missed_deadline" });
  });

  it("branch 2b: a missed_deadline value the model supplies UNPROMPTED (no question asked yet) is ignored, not trusted", async () => {
    const past = new Date(Date.now() - 60_000);
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "task-1", name: "Ship the thing" });
    getTaskById.mockResolvedValueOnce(makeTask(past));

    // No prior setPendingClarification — simulates the model pattern-matching
    // a boolean from an unrelated exchange instead of the system having asked.
    const result = await prepareMarkTaskDone({ task_query: "Ship the thing", missed_deadline: true });

    expect(result.status).toBe("need_field");
  });

  it("branch 3: late, user says NOT missed after being asked (legitimate scope change) — respects the answer", async () => {
    const past = new Date(Date.now() - 60_000);
    resolveEntity.mockResolvedValue({ status: "resolved", id: "task-1", name: "Ship the thing" });
    getTaskById.mockResolvedValue(makeTask(past));

    await prepareMarkTaskDone({ task_query: "Ship the thing" }); // system asks, sets clarification
    const result = await prepareMarkTaskDone({ task_query: "Ship the thing", missed_deadline: false });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.missedDeadline).toBe(false);
    }
  });

  it("branch 4: late, user confirms missed after being asked — sets missedDeadline true", async () => {
    const past = new Date(Date.now() - 60_000);
    resolveEntity.mockResolvedValue({ status: "resolved", id: "task-1", name: "Ship the thing" });
    getTaskById.mockResolvedValue(makeTask(past));

    await prepareMarkTaskDone({ task_query: "Ship the thing" }); // system asks, sets clarification
    const result = await prepareMarkTaskDone({ task_query: "Ship the thing", missed_deadline: true });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.missedDeadline).toBe(true);
    }
  });
});
