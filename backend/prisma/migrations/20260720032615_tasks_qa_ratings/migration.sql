-- Note: prisma migrate diff wants to drop devs/pods/projects_name_trgm_idx
-- because those indexes were added by raw SQL, not a Prisma @@index — they
-- are intentionally kept and NOT represented in schema.prisma. Do not let a
-- future auto-generated migration drop them; strip those DROP INDEX
-- statements by hand each time, as done here.

-- CreateTable
CREATE TABLE "pending_supersessions" (
    "id" TEXT NOT NULL,
    "original_task_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_supersessions_pkey" PRIMARY KEY ("id")
);

-- Fuzzy disambiguation for task_query (docs/03-agent-and-llm.md matching
-- strategy), matching the same pattern as devs/pods/projects.
CREATE INDEX "tasks_title_trgm_idx" ON "tasks" USING GIN ("title" gin_trgm_ops);
