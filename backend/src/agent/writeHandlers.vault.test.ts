const resolveEntity = jest.fn();
jest.mock("./disambiguation", () => ({
  resolveEntity: (...args: unknown[]) => resolveEntity(...args),
}));

const getVaultItemById = jest.fn();
jest.mock("../services/vaultService", () => ({
  getVaultItemById: (...args: unknown[]) => getVaultItemById(...args),
}));

// devService/projectService/ratingService/taskService are pulled in
// transitively by writeHandlers.ts for other tools — stub them so this file
// only exercises the vault prepare functions.
jest.mock("../services/devService", () => ({ checkDeleteDev: jest.fn(), getDevById: jest.fn() }));
jest.mock("../services/projectService", () => ({ checkDeleteProject: jest.fn() }));
jest.mock("../services/taskService", () => ({ getTaskById: jest.fn() }));
jest.mock("../services/ratingService", () => ({
  assertRatable: jest.fn(),
  NotRatableError: class NotRatableError extends Error {},
}));
jest.mock("../lib/prisma", () => ({ prisma: { pendingClarification: {} } }));

import {
  prepareCreateVaultItemMetadata,
  prepareEditVaultItemMetadata,
  prepareDeleteVaultItem,
} from "./writeHandlers";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("prepareCreateVaultItemMetadata", () => {
  it("asks for a name if missing", async () => {
    const result = await prepareCreateVaultItemMetadata({});
    expect(result.status).toBe("need_field");
  });

  it("is ready with just a name — the secret value is never part of this tool's args", async () => {
    const result = await prepareCreateVaultItemMetadata({ name: "AWS root" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs).not.toHaveProperty("secretValueEncrypted");
      expect(result.resolvedArgs).not.toHaveProperty("secret_value");
      expect(result.resolvedArgs).not.toHaveProperty("value");
      expect(result.summary).toContain("AWS root");
      expect(result.summary.toLowerCase()).toContain("secure widget");
    }
  });

  it("carries folder/tags/notes through untouched, never a secret field", async () => {
    const result = await prepareCreateVaultItemMetadata({
      name: "Stripe key",
      folder: "Payments",
      tags: ["billing", "prod"],
      notes: "Rotates yearly",
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs).toEqual({
        name: "Stripe key",
        folder: "Payments",
        tags: ["billing", "prod"],
        notes: "Rotates yearly",
      });
    }
  });
});

describe("prepareEditVaultItemMetadata", () => {
  it("asks which item if the query is missing", async () => {
    const result = await prepareEditVaultItemMetadata({ folder: "New" });
    expect(result.status).toBe("need_field");
  });

  it("surfaces ambiguous resolution instead of guessing", async () => {
    resolveEntity.mockResolvedValueOnce({
      status: "ambiguous",
      candidates: [
        { id: "v1", name: "AWS root", similarity: 0.6 },
        { id: "v2", name: "AWS staging", similarity: 0.58 },
      ],
    });
    const result = await prepareEditVaultItemMetadata({ vault_item_query: "AWS", folder: "Cloud" });
    expect(result.status).toBe("unresolved");
  });

  it("asks what to change if nothing was actually provided", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "v1", name: "AWS root" });
    const result = await prepareEditVaultItemMetadata({ vault_item_query: "AWS root" });
    expect(result.status).toBe("need_field");
  });

  it("is ready when a resolved item has a real metadata change", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "v1", name: "AWS root" });
    const result = await prepareEditVaultItemMetadata({ vault_item_query: "AWS root", folder: "Cloud" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.resolvedArgs.id).toBe("v1");
      expect(result.resolvedArgs.folder).toBe("Cloud");
      expect(result.resolvedArgs).not.toHaveProperty("secretValueEncrypted");
    }
  });
});

describe("prepareDeleteVaultItem", () => {
  it("asks which item if the query is missing", async () => {
    const result = await prepareDeleteVaultItem({});
    expect(result.status).toBe("need_field");
  });

  it("mentions the file attachment in the summary when one exists", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "v1", name: "ID scan" });
    getVaultItemById.mockResolvedValueOnce({ id: "v1", fileName: "id.pdf" });
    const result = await prepareDeleteVaultItem({ vault_item_query: "ID scan" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.summary).toContain("file attachment");
    }
  });

  it("omits file-attachment language when there is none", async () => {
    resolveEntity.mockResolvedValueOnce({ status: "resolved", id: "v1", name: "AWS root" });
    getVaultItemById.mockResolvedValueOnce({ id: "v1", fileName: null });
    const result = await prepareDeleteVaultItem({ vault_item_query: "AWS root" });
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.summary).not.toContain("file attachment");
    }
  });
});
