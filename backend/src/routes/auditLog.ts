import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../auth/requireAuth";

export const auditLogRouter = Router();
auditLogRouter.use(requireAuth);

auditLogRouter.get("/", async (_req, res) => {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.status(200).json(entries);
});
