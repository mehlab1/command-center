function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",

  // LLM — model identifiers are config, not hardcoded, since free-tier
  // availability shifts (docs/03-agent-and-llm.md). Verify these are still
  // on the free tier before relying on them long-term.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",

  // Vault (docs/05-vault-and-security.md) — AES-256-GCM key, base64 of 32
  // raw bytes, generated with `openssl rand -base64 32`. Never in git/DB.
  vaultEncryptionKey: required("VAULT_ENCRYPTION_KEY"),

  // Notifications (docs/06-scheduling-and-notifications.md) — optional like
  // the LLM keys above, not `required()`: several test suites import
  // modules that transitively reach this file without ever sending a real
  // push/WhatsApp message.
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  greenApiIdInstance: process.env.GREEN_API_ID_INSTANCE ?? "",
  greenApiTokenInstance: process.env.GREEN_API_TOKEN_INSTANCE ?? "",
};
