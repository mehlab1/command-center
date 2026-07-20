import { containsSecretLikeToken, mentionsVaultContext } from "./secretDetection";

describe("containsSecretLikeToken", () => {
  it("flags a mixed-class high-entropy token", () => {
    expect(containsSecretLikeToken("here it is: sk-abcDEF123456!!zzTop9000")).toBe(true);
  });

  it("flags known secret prefixes even without much class diversity", () => {
    expect(containsSecretLikeToken("AKIAABCDEFGHIJKLMNOP")).toBe(true);
    expect(containsSecretLikeToken("ghp_1234567890abcdefghijklmno")).toBe(true);
  });

  it("does not flag an ordinary lowercase+digit hash (e.g. a commit hash)", () => {
    expect(containsSecretLikeToken("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0")).toBe(false);
  });

  it("does not flag short tokens or ordinary prose", () => {
    expect(containsSecretLikeToken("what's the deadline on the marketing site project?")).toBe(false);
  });
});

describe("mentionsVaultContext", () => {
  it("flags vault/secret/credential keywords", () => {
    expect(mentionsVaultContext("here's my api key")).toBe(true);
    expect(mentionsVaultContext("save this password")).toBe(true);
    expect(mentionsVaultContext("add this to the vault")).toBe(true);
  });

  it("does not flag unrelated messages", () => {
    expect(mentionsVaultContext("push back the deadline on the marketing site")).toBe(false);
  });
});
