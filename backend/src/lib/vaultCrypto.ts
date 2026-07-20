import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = Buffer.from(env.vaultEncryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of a 256-bit key)");
  }
  return key;
}

// Output layout: [12-byte IV][16-byte auth tag][ciphertext] — one column,
// self-describing, per the storage-format note on VaultItem in schema.prisma.
export function encryptBuffer(plaintext: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptBuffer(encrypted: Buffer): Buffer {
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptText(plaintext: string): Buffer {
  return encryptBuffer(Buffer.from(plaintext, "utf8"));
}

export function decryptText(encrypted: Buffer): string {
  return decryptBuffer(encrypted).toString("utf8");
}
