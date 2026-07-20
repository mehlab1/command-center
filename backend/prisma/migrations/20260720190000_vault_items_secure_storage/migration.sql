-- Hand-written: the direct (unpooled) Neon endpoint was unreachable from
-- this machine when generating this migration (pooled connection worked
-- fine), so `prisma migrate dev` couldn't run its usual shadow-db diff.
-- This is a small, fully deterministic diff matching schema.prisma's
-- VaultItem model change — see the comment above that model for why.

-- secretValueEncrypted is now nullable: metadata is created before the
-- secret value is attached via the secure widget.
ALTER TABLE "vault_items" ALTER COLUMN "secret_value_encrypted" DROP NOT NULL;

-- file_attachment_url (a URL string) doesn't fit storing encrypted file
-- bytes directly in Postgres — replaced with fileName/fileMimeType/
-- fileBytesEncrypted.
ALTER TABLE "vault_items" DROP COLUMN "file_attachment_url";
ALTER TABLE "vault_items" ADD COLUMN "file_name" TEXT;
ALTER TABLE "vault_items" ADD COLUMN "file_mime_type" TEXT;
ALTER TABLE "vault_items" ADD COLUMN "file_bytes_encrypted" BYTEA;
