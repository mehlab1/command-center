-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'INTERN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "QaStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'PASSED', 'SENT_BACK');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('PUSH', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ReminderOccurrenceStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'EDIT', 'DELETE');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('CHAT', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'AGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "employment_type" "EmploymentType" NOT NULL,
    "internship_end_date" TIMESTAMP(3),
    "pod_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lead_dev_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "project_id" TEXT,
    "is_personal" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "deadline" TIMESTAMP(3) NOT NULL,
    "blocker_description" TEXT,
    "revised_deadline" TIMESTAMP(3),
    "missed_deadline" BOOLEAN,
    "needs_qa" BOOLEAN NOT NULL DEFAULT false,
    "superseded_by_task_id" TEXT,
    "supersedes_task_id" TEXT,
    "rating" INTEGER,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "task_id" TEXT NOT NULL,
    "dev_id" TEXT NOT NULL,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id","dev_id")
);

-- CreateTable
CREATE TABLE "qa_queue_entries" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" "QaStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "suggested_reviewer_dev_id" TEXT,
    "assigned_reviewer_dev_id" TEXT,
    "outcome_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "qa_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings_history" (
    "id" TEXT NOT NULL,
    "dev_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "on_time" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vault_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT,
    "tags" TEXT[],
    "secret_value_encrypted" BYTEA NOT NULL,
    "notes" TEXT,
    "file_attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "linked_task_id" TEXT,
    "linked_project_id" TEXT,
    "message" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'PUSH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_occurrences" (
    "id" TEXT NOT NULL,
    "reminder_id" TEXT NOT NULL,
    "fire_time" TIMESTAMP(3) NOT NULL,
    "status" "ReminderOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "reminder_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "action_type" "AuditActionType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" JSONB,
    "source" "AuditSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "linked_entity_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_deadline_idx" ON "projects"("deadline");

-- CreateIndex
CREATE INDEX "devs_pod_id_idx" ON "devs"("pod_id");

-- CreateIndex
CREATE UNIQUE INDEX "pods_lead_dev_id_key" ON "pods"("lead_dev_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_superseded_by_task_id_key" ON "tasks"("superseded_by_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_supersedes_task_id_key" ON "tasks"("supersedes_task_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_deadline_idx" ON "tasks"("deadline");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "task_assignees_dev_id_idx" ON "task_assignees"("dev_id");

-- CreateIndex
CREATE UNIQUE INDEX "qa_queue_entries_task_id_key" ON "qa_queue_entries"("task_id");

-- CreateIndex
CREATE INDEX "qa_queue_entries_status_idx" ON "qa_queue_entries"("status");

-- CreateIndex
CREATE INDEX "ratings_history_dev_id_idx" ON "ratings_history"("dev_id");

-- CreateIndex
CREATE INDEX "ratings_history_task_id_idx" ON "ratings_history"("task_id");

-- CreateIndex
CREATE INDEX "vault_items_folder_idx" ON "vault_items"("folder");

-- CreateIndex
CREATE INDEX "reminders_linked_task_id_idx" ON "reminders"("linked_task_id");

-- CreateIndex
CREATE INDEX "reminders_linked_project_id_idx" ON "reminders"("linked_project_id");

-- CreateIndex
CREATE INDEX "reminder_occurrences_status_fire_time_idx" ON "reminder_occurrences"("status", "fire_time");

-- CreateIndex
CREATE INDEX "reminder_occurrences_reminder_id_idx" ON "reminder_occurrences"("reminder_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- AddForeignKey
ALTER TABLE "devs" ADD CONSTRAINT "devs_pod_id_fkey" FOREIGN KEY ("pod_id") REFERENCES "pods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pods" ADD CONSTRAINT "pods_lead_dev_id_fkey" FOREIGN KEY ("lead_dev_id") REFERENCES "devs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_dev_id_fkey" FOREIGN KEY ("dev_id") REFERENCES "devs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_queue_entries" ADD CONSTRAINT "qa_queue_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_queue_entries" ADD CONSTRAINT "qa_queue_entries_suggested_reviewer_dev_id_fkey" FOREIGN KEY ("suggested_reviewer_dev_id") REFERENCES "devs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_queue_entries" ADD CONSTRAINT "qa_queue_entries_assigned_reviewer_dev_id_fkey" FOREIGN KEY ("assigned_reviewer_dev_id") REFERENCES "devs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings_history" ADD CONSTRAINT "ratings_history_dev_id_fkey" FOREIGN KEY ("dev_id") REFERENCES "devs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings_history" ADD CONSTRAINT "ratings_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_linked_project_id_fkey" FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
