import { Router } from "express";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected", time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});
