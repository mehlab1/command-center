import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { auditLogRouter } from "./routes/auditLog";
import { entitiesRouter } from "./routes/entities";
import { dashboardRouter } from "./routes/dashboard";
import { vaultRouter } from "./routes/vault";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  // 10mb, up from the 100kb default — Vault file attachments (Phase 5) are
  // base64-encoded in the request body, which adds ~33% overhead on top of
  // the encrypted bytes. Still a single free-tier Node service, no separate
  // upload path needed for a personal vault's modest file sizes.
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/audit-log", auditLogRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/vault", vaultRouter);
  app.use("/api", entitiesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
