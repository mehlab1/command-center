-- Note: prisma migrate diff wants to drop the hand-added trgm indexes again
-- (see migration 20260720011855 and 20260720032615) — not represented in
-- schema.prisma on purpose, always strip these DROP INDEX statements.

-- CreateTable
CREATE TABLE "pending_clarifications" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_clarifications_pkey" PRIMARY KEY ("id")
);
