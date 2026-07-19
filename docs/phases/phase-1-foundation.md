# Phase 1 — Foundation

**Goal:** prove the free-tier plumbing end to end (Neon ↔ Render ↔ Vercel) with a minimal but
real deployed app, before any agent/chat complexity is layered on. If this phase's cold-start
and connection behavior isn't solid, nothing built on top of it will be either.

## Prerequisites
- All items in `docs/00-human-setup-tasks.md` complete; credentials available.

## Tasks

1. **Repo scaffold.** Initialize `/frontend` (Next.js App Router, TypeScript, Tailwind) and
   `/backend` (NestJS or Express, TypeScript — pick and document the reasoning per CLAUDE.md).
   Set up `.gitignore` for `.env*`, `node_modules`, build artifacts, from the very first commit.

2. **Prisma + Neon wiring.** Set up `backend/prisma/schema.prisma` per `docs/02-database-
   schema.md` (the `DATABASE_URL`/`DIRECT_URL` split). Implement the full schema from
   `docs/01-data-model.md` now, even though most of it won't be used until later phases —
   better to get the schema right once than to keep migrating it phase by phase.

3. **Single-user auth.** Implement a simple login for Mehlab (email+password with hashed
   storage, or a magic-link approach — your call, document reasoning). No multi-user, no roles.
   Session handling should work across the Render cold-start boundary (i.e. don't store
   sessions only in server memory, which would evaporate on Render's sleep/wake cycle — use a
   DB-backed or JWT-based session so a wake doesn't force a re-login).

4. **Minimal backend deploy to Render.** Deploy the barebones API (health check endpoint,
   auth endpoints) as a free Web Service. Confirm `DATABASE_URL`/`DIRECT_URL` env vars are
   correctly set in Render's dashboard (never committed to git).

5. **Minimal frontend deploy to Vercel.** Deploy a barebones Next.js app (login screen only)
   to Vercel free tier, pointed at the Render backend URL.

6. **PWA scaffold (not full push yet).** Add `manifest.json` and a basic service worker now,
   even before push notifications are implemented in Phase 6 — establishing the PWA foundation
   early means Phase 6 is additive, not a retrofit. Confirm the app is installable ("Add to
   Home Screen" appears) on an actual Android phone at the end of this phase.

7. **Cold-start UX baseline.** Implement the generic "waking things up…" loading state
   described in `docs/07-frontend-design-system.md`, wired to real request timing (not
   simulated) — Phase 1 is the right time to build this since it depends only on
   frontend↔backend↔DB round trips, all of which already exist by now.

## Test Gate — must all pass before Phase 2

- [ ] `npx prisma migrate deploy` runs clean against the real Neon `DIRECT_URL`.
- [ ] Full schema from `docs/01-data-model.md` exists in the Neon database (verified via
      `prisma studio` or a direct query), even though most tables are still empty.
- [ ] Backend is live on a real Render free Web Service URL, health check returns 200.
- [ ] Frontend is live on a real Vercel URL, loads the login screen.
- [ ] Login works end to end against the deployed backend.
- [ ] Letting the Render service go idle 15+ minutes, then hitting the app, shows the
      "waking things up" state and then successfully loads — verified on the real deployment,
      not local dev.
- [ ] The deployed frontend is installable as a PWA on an actual Android phone.
- [ ] No secrets present in git history.
