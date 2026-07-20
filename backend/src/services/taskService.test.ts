const taskUpdate = jest.fn();
jest.mock("../lib/prisma", () => ({
  prisma: { task: { update: (...args: unknown[]) => taskUpdate(...args) } },
}));

import { markTaskBlocked } from "./taskService";

beforeEach(() => jest.clearAllMocks());

// docs/04-workflows.md: reject any mark-blocked call missing either field —
// enforced here at the service layer specifically (not just the tool schema
// or the chat prompt) so it can't be bypassed by an unusual LLM output that
// somehow calls the service with only one field present.
describe("markTaskBlocked — dual-field enforcement at the service layer", () => {
  it("rejects when blockerDescription is missing", async () => {
    await expect(markTaskBlocked("task-1", undefined, new Date())).rejects.toThrow(
      "requires both blockerDescription and revisedDeadline"
    );
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("rejects when revisedDeadline is missing", async () => {
    await expect(markTaskBlocked("task-1", "waiting on design sign-off", undefined)).rejects.toThrow(
      "requires both blockerDescription and revisedDeadline"
    );
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("rejects when both are missing", async () => {
    await expect(markTaskBlocked("task-1", undefined, undefined)).rejects.toThrow();
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("succeeds when both fields are present", async () => {
    taskUpdate.mockResolvedValueOnce({ id: "task-1", status: "BLOCKED" });
    const revised = new Date();

    await markTaskBlocked("task-1", "waiting on design sign-off", revised);

    expect(taskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "BLOCKED", blockerDescription: "waiting on design sign-off", revisedDeadline: revised },
    });
  });
});
