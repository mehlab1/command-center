const chatMessageCreate = jest.fn();
const pendingActionCreate = jest.fn();
const pendingActionDeleteMany = jest.fn();
const pendingActionFindUnique = jest.fn();
const pendingActionFindFirst = jest.fn();
const pendingActionDelete = jest.fn();

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

import { handleUserMessage, confirmPendingAction, cancelPendingAction } from "./orchestrator";

beforeEach(() => {
  jest.clearAllMocks();
  pendingActionCreate.mockImplementation((args: { data: unknown }) => ({
    id: "pending-1",
    ...(args.data as object),
  }));
  pendingActionFindFirst.mockResolvedValue(null);
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

describe("cancelPendingAction", () => {
  it("deletes the pending action and writes nothing to the audit log", async () => {
    pendingActionFindUnique.mockResolvedValueOnce({
      id: "pending-1",
      toolName: "create_dev",
      args: {},
      summary: "Add dev X",
    });

    const ok = await cancelPendingAction("pending-1");

    expect(ok).toBe(true);
    expect(pendingActionDelete).toHaveBeenCalledWith({ where: { id: "pending-1" } });
    expect(executeWrite).not.toHaveBeenCalled();
  });

  it("returns false for an already-resolved or unknown pending action", async () => {
    pendingActionFindUnique.mockResolvedValueOnce(null);
    const ok = await cancelPendingAction("does-not-exist");
    expect(ok).toBe(false);
    expect(pendingActionDelete).not.toHaveBeenCalled();
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
    expect(result).toEqual({ message: expect.stringContaining("Ehsan"), entityType: "dev", entityId: "dev-123" });
  });
});
