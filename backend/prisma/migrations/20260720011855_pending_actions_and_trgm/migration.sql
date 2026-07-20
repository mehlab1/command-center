-- CreateTable
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- Enable trigram matching for fuzzy entity-name disambiguation
-- (docs/03-agent-and-llm.md — exact -> case-insensitive -> fuzzy/trigram -> ambiguous)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "devs_name_trgm_idx" ON "devs" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "pods_name_trgm_idx" ON "pods" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "projects_name_trgm_idx" ON "projects" USING GIN ("name" gin_trgm_ops);
