import { prisma } from "../lib/prisma";
import { AuditActionType, AuditSource, Prisma } from "@prisma/client";

export async function recordAudit(params: {
  actionType: AuditActionType;
  entityType: string;
  entityId: string;
  summary: string;
  diff?: unknown;
  source: AuditSource;
}) {
  return prisma.auditLog.create({
    data: {
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      diff: params.diff as Prisma.InputJsonValue | undefined,
      source: params.source,
    },
  });
}
