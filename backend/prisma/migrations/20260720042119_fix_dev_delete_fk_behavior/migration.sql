-- Note: prisma migrate diff wants to drop the hand-added trgm indexes again
-- (see prior migrations) — not represented in schema.prisma on purpose,
-- always strip these DROP INDEX statements.

-- DropForeignKey
ALTER TABLE "ratings_history" DROP CONSTRAINT "ratings_history_dev_id_fkey";

-- AddForeignKey
ALTER TABLE "ratings_history" ADD CONSTRAINT "ratings_history_dev_id_fkey" FOREIGN KEY ("dev_id") REFERENCES "devs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
