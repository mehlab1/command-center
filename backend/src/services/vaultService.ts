import { prisma } from "../lib/prisma";
import { decryptBuffer, decryptText, encryptBuffer, encryptText } from "../lib/vaultCrypto";

export interface VaultItemListEntry {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  notes: string | null;
  hasSecret: boolean;
  fileName: string | null;
  fileMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Never selects secretValueEncrypted/fileBytesEncrypted — list/detail views
// only ever see whether a secret/file exists, never its bytes.
const METADATA_SELECT = {
  id: true,
  name: true,
  folder: true,
  tags: true,
  notes: true,
  fileName: true,
  fileMimeType: true,
  createdAt: true,
  updatedAt: true,
  secretValueEncrypted: true,
} as const;

function toListEntry(row: {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  notes: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
  secretValueEncrypted: Uint8Array | null;
}): VaultItemListEntry {
  const { secretValueEncrypted, ...rest } = row;
  return { ...rest, hasSecret: secretValueEncrypted !== null };
}

export async function listVaultItems(filter: { folder?: string; tag?: string; q?: string }): Promise<VaultItemListEntry[]> {
  const rows = await prisma.vaultItem.findMany({
    where: {
      folder: filter.folder ? filter.folder : undefined,
      tags: filter.tag ? { has: filter.tag } : undefined,
      name: filter.q ? { contains: filter.q, mode: "insensitive" } : undefined,
    },
    select: METADATA_SELECT,
    orderBy: { name: "asc" },
  });
  return rows.map(toListEntry);
}

export async function getVaultItemMetadata(id: string): Promise<VaultItemListEntry | null> {
  const row = await prisma.vaultItem.findUnique({ where: { id }, select: METADATA_SELECT });
  return row ? toListEntry(row) : null;
}

export async function getVaultItemById(id: string) {
  return prisma.vaultItem.findUnique({ where: { id } });
}

export async function createVaultItemMetadata(input: {
  name: string;
  folder?: string;
  tags?: string[];
  notes?: string;
}) {
  return prisma.vaultItem.create({
    data: {
      name: input.name,
      folder: input.folder,
      tags: input.tags ?? [],
      notes: input.notes,
    },
  });
}

export async function editVaultItemMetadata(
  id: string,
  input: Partial<{ name: string; folder: string; tags: string[]; notes: string }>
) {
  return prisma.vaultItem.update({ where: { id }, data: input });
}

export async function deleteVaultItem(id: string) {
  return prisma.vaultItem.delete({ where: { id } });
}

export async function setSecretValue(id: string, plaintext: string): Promise<void> {
  await prisma.vaultItem.update({
    where: { id },
    // Buffer's ArrayBufferLike type param doesn't structurally match
    // Prisma's Uint8Array<ArrayBuffer> field type — Buffer content itself
    // is fine, this is a generics-only mismatch.
    data: { secretValueEncrypted: new Uint8Array(encryptText(plaintext)) },
  });
}

export async function getSecretValue(id: string): Promise<string | null> {
  const row = await prisma.vaultItem.findUnique({ where: { id }, select: { secretValueEncrypted: true } });
  if (!row?.secretValueEncrypted) return null;
  return decryptText(Buffer.from(row.secretValueEncrypted));
}

export async function setFileAttachment(
  id: string,
  fileName: string,
  mimeType: string,
  plainBytes: Buffer
): Promise<void> {
  await prisma.vaultItem.update({
    where: { id },
    data: {
      fileName,
      fileMimeType: mimeType,
      fileBytesEncrypted: new Uint8Array(encryptBuffer(plainBytes)),
    },
  });
}

export async function getFileAttachment(
  id: string
): Promise<{ fileName: string; mimeType: string; bytes: Buffer } | null> {
  const row = await prisma.vaultItem.findUnique({
    where: { id },
    select: { fileName: true, fileMimeType: true, fileBytesEncrypted: true },
  });
  if (!row?.fileBytesEncrypted || !row.fileName || !row.fileMimeType) return null;
  return {
    fileName: row.fileName,
    mimeType: row.fileMimeType,
    bytes: decryptBuffer(Buffer.from(row.fileBytesEncrypted)),
  };
}

// Any item still missing its secret is a candidate target for the chat
// redirect heuristic (docs/05-vault-and-security.md) — most-recent first
// since that's almost always the one the user is mid-flow on.
export async function findItemAwaitingSecret() {
  return prisma.vaultItem.findFirst({
    where: { secretValueEncrypted: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
}
