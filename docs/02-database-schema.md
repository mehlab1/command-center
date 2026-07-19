# Database Schema & Neon/Prisma Connection Specifics

## Critical: two connection strings, not one

Neon separates pooled (PgBouncer) and direct connections. Getting this wrong is the single
most common silent-failure point in this stack, so read this before touching `schema.prisma`.

```
# backend/.env
DATABASE_URL="postgresql://<user>:<pass>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<pass>@<endpoint>.<region>.aws.neon.tech/<db>?sslmode=require"
```

- `DATABASE_URL` (has `-pooler` in the hostname) → used by the running application for normal
  query traffic. Required for a serverless-ish free-tier setup because it multiplexes
  connections via PgBouncer instead of opening one Postgres connection per request.
- `DIRECT_URL` (no `-pooler`) → used ONLY for `prisma migrate` and any admin/seed scripts.
  PgBouncer runs in transaction pooling mode on Neon, which breaks prepared statements and
  session-level `SET`/`RESET` — migrations will fail or behave strangely through the pooled
  connection.

In `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Run `npx prisma migrate dev` (uses `directUrl` automatically) for schema changes. The running
NestJS/Express app should instantiate its Prisma client against `DATABASE_URL` only.

## Cold start behavior (expected, not a bug)

Neon's free-tier compute scales to zero after inactivity (default ~5 min) and takes anywhere
from ~500ms to a few seconds to wake on the next query. Combined with Render's own 15-minute
sleep/30-60s cold start, the worst case (both asleep) could be a several-second delay on the
very first request after a long idle period. Handle this in two places:
1. **Backend:** set a reasonable Prisma/pg connection timeout (don't let a cold-start wake take
   down the request with a premature timeout — a few seconds of headroom is fine for a
   single-user app).
2. **Frontend:** show a "waking things up…" loading state rather than a blank screen or error
   on first load after idle — see `docs/07-frontend-design-system.md` for the exact UX pattern.

In practice, the cron-job.org ping described in `docs/06-scheduling-and-notifications.md` will
keep the Render backend warm during any hours it's configured to run, which incidentally also
reduces how often Neon's compute goes fully cold — a natural side benefit of the scheduling
approach, not something to rely on exclusively.

## Schema sketch (finalize types/indexes/relations yourself)

This is intentionally not a full `schema.prisma` — build it out based on `docs/01-data-model.md`
using your judgment on:
- Which fields need indexes (deadline lookups, dev_id lookups, and status filters will be hit
  constantly by the dashboard — index accordingly)
- Enum vs string+check-constraint tradeoffs (Prisma enums are fine for the fixed enums listed
  in the data model doc)
- Whether `reminders.fire_times` becomes a normalized child table (`reminder_occurrences`) —
  the data model doc flags this as a judgment call; lean toward normalizing since it makes
  per-occurrence cancel/sent tracking far cleaner in SQL and in the cron tick handler
- Cascade behavior on deletes: e.g. deleting a `pod` should not cascade-delete its `devs` (they
  just lose their `pod_id`); deleting a `project` follows the explicit two-path behavior in
  `docs/04-workflows.md` (cascade tasks or orphan them, per what Mehlab said in chat) — do NOT
  hardcode a Postgres `ON DELETE CASCADE` for projects→tasks, since the choice is runtime, not
  schema-level. Implement it as an explicit application-layer branch instead.

## Seeding

Write a `backend/prisma/seed.ts` that creates zero fake demo data (this is Mehlab's real
production data from day one, not a demo) but does establish the one `settings` row needed for
defaults (`daily_digest_time`) so the app doesn't crash on first load looking for a missing
config key.
