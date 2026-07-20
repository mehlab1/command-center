const chatMessageCreate = jest.fn();
const pendingActionCreate = jest.fn();
const pendingActionDeleteMany = jest.fn();
const pendingActionFindUnique = jest.fn();
const pendingActionFindFirst = jest.fn();
const pendingActionDelete = jest.fn();
const batchQueueDeleteMany = jest.fn();
const batchQueueCreateMany = jest.fn();
const batchQueueFindFirst = jest.fn();
const batchQueueDelete = jest.fn();

jest.mock("../lib/prisma", () => ({
  prisma: {
    chatMessage: {
      create: (...args: unknown[]) => chatMessageCreate(...args),
      findMany: jest.fn().mockResolvedValue([]),
    },
    pendingAction: {
      deleteMany: (...args: unknown[]) => pendingActionDeleteMany(...args),
      create: (...args: unknown[]) => pendingActionCreate(...args),
      findUnique: (...args: unknown[]) => pendingActionFindUnique(...args),
      findFirst: (...args: unknown[]) => pendingActionFindFirst(...args),
      delete: (...args: unknown[]) => pendingActionDelete(...args),
    },
    pendingBatchQueue: {
      deleteMany: (...args: unknown[]) => batchQueueDeleteMany(...args),
      createMany: (...args: unknown[]) => batchQueueCreateMany(...args),
      findFirst: (...args: unknown[]) => batchQueueFindFirst(...args),
      delete: (...args: unknown[]) => batchQueueDelete(...args),
    },
  },
}));

const llmChat = jest.fn();
jest.mock("../llm/router", () => ({ llmRouter: { chat: (...args: unknown[]) => llmChat(...args) } }));

const resolveEntity = jest.fn();
jest.mock("./disambiguation", () => ({
  resolveEntity: (...args: unknown[]) => resolveEntity(...args),
}));

const executeWrite = jest.fn();
jest.mock("./execute", () => ({ executeWrite: (...args: unknown[]) => executeWrite(...args) }));

const findItemAwaitingSecret = jest.fn();
jest.mock("../services/vaultService", () => ({
  findItemAwaitingSecret: (...args: unknown[]) => findItemAwaitingSecret(...args),
}));

import { handleUserMessage, confirmPendingAction, cancelPendingAction } from "./orchestrator";

let pendingActionIdCounter = 0;

beforeEach(() => {
  jest.clearAllMocks();
  pendingActionIdCounter = 0;
  pendingActionCreate.mockImplementation((args: { data: unknown }) => ({
    id: `pending-${++pendingActionIdCounter}`,
    ...(args.data as object),
  }));
  pendingActionFindFirst.mockResolvedValue(null);
  batchQueueFindFirst.mockResolvedValue(null);
  findItemAwaitingSecret.mockResolvedValue(null);
});

describe("handleUserMessage — write tool with all fields resolved", () => {
  it("creates a PendingAction and asks for confirmation instead of writing directly", async () => {
    llmChat.mockResolvedValueOnce({
      provider: "gemini",
      toolCalls: [{ id: "call-1", name: "create_dev", args: { name: "Ehsan", employment_type: "PERMANENT" } }],
    });

    const result = await handleUserMessage("add a permanent dev named Ehsan");

    expect(result.type).toBe("confirm");
    expect(pendingActionCreate).toHaveBeenCalledTimes(1);
    expect(pendingActionDeleteMany).toHaveBeenCalledTimes(1); // clears any stale pending action first
    if (result.type === "confirm") {
      expect(result.message).toContain("Ehsan");
      expect(result.pendingActionId).toBe("pending-1");
    }
    // Nothing was actually written yet.
    expect(executeWrite).not.toHaveBeenCalled();
  });
});

describe("handleUserMessage — ambiguous entity reference", () => {
  it("asks the user to disambiguate instead of guessing or writing", async () => {
    llmChat.mockResolvedValueOnce({
      provider: "gemini",
      toolCalls: [{ id: "call-1", name: "edit_dev", args: { dev_query: "Ehsan", designation: "Lead Engineer" } }],
    });
    resolveEntity.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [
        { id: "d1", name: "Ehsan Malik", similarity: 0.6 },
        { id: "d2", name: "Ehsan Raza", similarity: 0.58 },
      ],
    });

    const result = await handleUserMessage("update Ehsan's designation");

    expect(result.type).toBe("message");
    expect(result.message).toMatch(/Ehsan Malik/);
    expect(result.message).toMatch(/Ehsan Raza/);
    expect(pendingActionCreate).not.toHaveBeenCalled();
  });
});

describe("handleUserMessage — multiple entities described in one message", () => {
  it("processes every tool call the LLM returns, not just the first", async () => {
    llmChat.mockResolvedValueOnce({
      provider: "gemini",
      toolCalls: [
        { id: "call-1", name: "create_dev", args: { name: "Alice", employment_type: "PERMANENT" } },
        { id: "call-2", name: "create_dev", args: { name: "Bob", employment_type: "PERMANENT" } },
        { id: "call-3", name: "create_dev", args: { name: "Carol", employment_type: "PERMANENT" } },
      ],
    });

    const result = await handleUserMessage("add devs Alice, Bob, and Carol, all permanent");

    // Item 1 becomes the active PendingAction immediately...
    expect(result.type).toBe("confirm");
    expect(pendingActionCreate).toHaveBeenCalledTimes(1);
    // ...and items 2-3 are queued, not dropped.
    expect(batchQueueCreateMany).toHaveBeenCalledTimes(1);
    const queuedData = batchQueueCreateMany.mock.calls[0][0].data;
    expect(queuedData).toHaveLength(2);
    expect(queuedData.map((d: { summary: string }) => d.summary).join(" ")).toContain("Bob");
    expect(queuedData.map((d: { summary: string }) => d.summary).join(" ")).toContain("Carol");
  });

  it("combines missing-field questions across items instead of asking one at a time", async () => {
    llmChat.mockResolvedValueOnce({
      provider: "gemini",
      toolCalls: [
        { id: "call-1", name: "create_dev", args: { name: "Alice", employment_type: "PERMANENT" } },
        { id: "call-2", name: "create_dev", args: { name: "Dave" } }, // missing employment_type
      ],
    });

    const result = await handleUserMessage("add devs Alice and Dave, Alice is permanent");

    expect(result.type).toBe("message");
    if (result.type === "message") {
      expect(result.message).toContain("Dave");
      expect(result.message.toLowerCase()).toContain("permanent");
    }
    // Nothing queued yet — the whole batch waits until every item resolves.
    expect(pendingActionCreate).not.toHaveBeenCalled();
    expect(batchQueueCreateMany).not.toHaveBeenCalled();
  });
});

describe("handleUserMessage — vault secret chat redirect", () => {
  it("redirects instead of calling the LLM when a message mentions vault context and contains a secret-shaped token", async () => {
    const result = await handleUserMessage("here's the api key for it: sk-abcDEF123456!!zzTop9000");

    expect(result.type).toBe("message");
    if (result.type === "message") {
      expect(result.message.toLowerCase()).toContain("secure");
    }
    expect(llmChat).not.toHaveBeenCalled();
  });

  it("redirects a bare high-entropy paste with no keywords when a vault item is awaiting its secret", async () => {
    findItemAwaitingSecret.mockResolvedValueOnce({ id: "vault-1", name: "AWS root" });

    const result = await handleUserMessage("sk-abcDEF123456!!zzTop9000");

    expect(result.type).toBe("message");
    if (result.type === "message") {
      expect(result.message).toContain("AWS root");
    }
    expect(llmChat).not.toHaveBeenCalled();
  });

  it("does not redirect an ordinary message with no secret-shaped token", async () => {
    llmChat.mockResolvedValueOnce({ provider: "gemini", toolCalls: [], content: "Sure thing." });

    const result = await handleUserMessage("what's the deadline on the marketing site project?");

    expect(llmChat).toHaveBeenCalledTimes(1);
    expect(result.type).toBe("message");
  });

  it("does not redirect a long token with no vault context and no item awaiting secret", async () => {
    llmChat.mockResolvedValueOnce({ provider: "gemini", toolCalls: [], content: "Got it." });

    const result = await handleUserMessage("the commit hash is a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");

    expect(llmChat).toHaveBeenCalledTimes(1);
    expect(result.type).toBe("message");
  });
});

describe("cancelPendingAction", () => {
  it("deletes the pending action and writes nothing to the audit log", async () => {
    pendingActionFindUnique.mockResolvedValueOnce({
      id: "pending-1",
      toolName: "create_dev",
      args: {},
      summary: "Add dev X",
    });

    const result = await cancelPendingAction("pending-1");

    expect(result).not.toBeNull();
    expect(result?.next).toBeUndefined();
    expect(pendingActionDelete).toHaveBeenCalledWith({ where: { id: "pending-1" } });
    expect(executeWrite).not.toHaveBeenCalled();
  });

  it("returns null for an already-resolved or unknown pending action", async () => {
    pendingActionFindUnique.mockResolvedValueOnce(null);
    const result = await cancelPendingAction("does-not-exist");
    expect(result).toBeNull();
    expect(pendingActionDelete).not.toHaveBeenCalled();
  });

  it("advances to the next queued batch item after cancelling the current one", async () => {
    pendingActionFindUnique.mockResolvedValueOnce({
      id: "pending-1",
      toolName: "create_dev",
      args: {},
      summary: "Add dev Bob",
    });
    batchQueueFindFirst.mockResolvedValueOnce({
      id: "queue-1",
      order: 0,
      position: 2,
      total: 2,
      toolName: "create_dev",
      resolvedArgs: { name: "Carol" },
      summary: 'Add dev "Carol" (PERMANENT).',
    });

    const result = await cancelPendingAction("pending-1");

    expect(batchQueueDelete).toHaveBeenCalledWith({ where: { id: "queue-1" } });
    expect(pendingActionCreate).toHaveBeenCalledTimes(1); // promotes Carol
    expect(result?.next?.message).toContain("Carol");
    expect(result?.next?.message).toContain("2/2");
  });
});

describe("confirmPendingAction", () => {
  it("executes the write, then deletes the pending action", async () => {
    pendingActionFindUnique.mockResolvedValueOnce({
      id: "pending-1",
      toolName: "create_dev",
      args: { name: "Ehsan", employmentType: "PERMANENT" },
      summary: 'Add dev "Ehsan" (PERMANENT).',
    });
    executeWrite.mockResolvedValueOnce({ entityType: "dev", entityId: "dev-123" });

    const result = await confirmPendingAction("pending-1");

    expect(executeWrite).toHaveBeenCalledWith(
      "create_dev",
      { name: "Ehsan", employmentType: "PERMANENT" },
      'Add dev "Ehsan" (PERMANENT).'
    );
    expect(pendingActionDelete).toHaveBeenCalledWith({ where: { id: "pending-1" } });
    expect(result).toEqual({
      message: expect.stringContaining("Ehsan"),
      entityType: "dev",
      entityId: "dev-123",
      next: undefined,
    });
  });
});
