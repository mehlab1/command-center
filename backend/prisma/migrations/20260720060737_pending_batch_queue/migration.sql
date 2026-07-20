-- Note: prisma migrate diff wants to drop the hand-added trgm indexes again
-- (see prior migrations) — not represented in schema.prisma on purpose,
-- always strip these DROP INDEX statements.

-- CreateTable
CREATE TABLE "pending_batch_queue" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "tool_name" TEXT NOT NULL,
    "resolved_args" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_batch_queue_pkey" PRIMARY KEY ("id")
);
