process.env.VAULT_ENCRYPTION_KEY = "laU4ED0ckoRFTzhg9zBTdT2CuATiY7aQhHd8l3eKAtg=";
process.env.JWT_SECRET = "test-secret";

import { decryptBuffer, decryptText, encryptBuffer, encryptText } from "./vaultCrypto";

describe("vault text encryption", () => {
  it("round-trips a plaintext string", () => {
    const encrypted = encryptText("sk-super-secret-value-123");
    expect(decryptText(encrypted)).toBe("sk-super-secret-value-123");
  });

  it("never stores the plaintext as a readable substring of the ciphertext", () => {
    const plaintext = "sk-super-secret-value-123";
    const encrypted = encryptText(plaintext);
    expect(encrypted.toString("utf8")).not.toContain(plaintext);
    expect(encrypted.toString("base64")).not.toContain(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptText("same value");
    const b = encryptText("same value");
    expect(a.equals(b)).toBe(false);
    expect(decryptText(a)).toBe("same value");
    expect(decryptText(b)).toBe("same value");
  });

  it("fails to decrypt if the ciphertext is tampered with (auth tag check)", () => {
    const encrypted = encryptText("sk-super-secret-value-123");
    encrypted[encrypted.length - 1] ^= 0xff; // flip a byte in the ciphertext
    expect(() => decryptText(encrypted)).toThrow();
  });
});

describe("vault file encryption", () => {
  it("round-trips binary file content", () => {
    const original = Buffer.from([0, 1, 2, 255, 254, 253, 10, 13, 0]);
    const encrypted = encryptBuffer(original);
    expect(decryptBuffer(encrypted).equals(original)).toBe(true);
  });
});
