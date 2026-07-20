# FinovaSolutions Command Center — CLAUDE.md

You are building a personal, chat-first, agentic project/team management system for Mehlab
(CTO, FinovaSolutions). This file is the always-loaded root context. Detailed specs live in
`docs/` and are loaded on demand — read the relevant doc before starting each phase, don't
try to hold all of them in context at once.

## Golden rules (never violate these)

1. **Zero paid services.** Every piece of infrastructure must run on a genuine free tier:
   Neon (DB), Render free Web Service (backend), Vercel free/Hobby (frontend), Gemini free
   tier + Groq free tier (LLM), cron-job.org free (scheduling), Firebase Cloud Messaging free
   (push), Green API free tier (WhatsApp). If a task seems to require a paid tier or a paid
   add-on, STOP and flag it in your output instead of proceeding or silently substituting
   something that costs money. Render's own Cron Jobs are NOT free (min $1/mo) — do not use
   them. Use the external cron-job.org → `/api/cron/tick` pattern instead (see `docs/06-scheduling-and-notifications.md`).

2. **Human tasks are batched, never interleaved.** Some steps require Mehlab personally
   (creating accounts, generating API keys, clicking "verify" in a dashboard, installing an
   APK on his phone). These are collected into `docs/00-human-setup-tasks.md` (must happen
   BEFORE you write code that depends on them) and `docs/99-human-final-tasks.md` (must happen
   AFTER all code is complete). Never stop mid-phase to ask Mehlab to go do something — if a
   phase needs a credential that isn't in `00-human-setup-tasks.md` yet, that's a planning bug;
   flag it rather than inventing a mid-stream human step.

3. **Confirm-before-commit is a system-wide behavior, not a feature.** Every agentic DB write
   (create/edit/delete triggered via the chat agent) must go through: extract → disambiguate
   if uncertain → summarize in plain language → wait for explicit confirmation → write → log to
   `audit_log`. This is core application behavior you're building, not a suggestion for how you
   personally operate as a coding agent.

4. **Work in phases, in order.** Phase files are in `docs/phases/`. Do not start phase N+1
   until phase N's test gate passes. Each phase file lists explicit pass/fail test criteria —
   treat these as hard gates, not suggestions. If a gate fails, fix it before moving on.

5. **No silent scope changes.** If something in the phase docs conflicts with what's clearly
   better practice, or a free-tier constraint makes a spec'd feature genuinely impossible,
   stop and surface the conflict clearly instead of quietly reinterpreting the spec.

6. **Mobile-first, not mobile-adapted.** The frontend is designed for a phone screen first,
   then scaled up — never the reverse. Read `docs/07-frontend-design-system.md` before writing
   any UI code. Avoid generic "AI-slop" component patterns (see that doc for specifics on what
   to avoid and what to do instead).

7. **Security defaults.** Never commit `.env` files or secrets. Vault secret values never pass
   through the LLM — see `docs/05-vault-and-security.md` for the exact bypass mechanism. All
   encryption keys live in Render/Vercel environment variables, never in the database or repo.

## Tech stack (fixed — do not substitute without flagging why)

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, deployed on Vercel free tier.
  Built as an installable PWA from the start (manifest + service worker), not bolted on later.
- **Backend:** Node.js + NestJS (or Express if you judge NestJS overhead isn't worth it for a
  single-user app — your call, but document the reasoning), TypeScript, deployed on Render free
  Web Service.
- **ORM / DB:** Prisma + Neon Postgres free tier. See `docs/02-database-schema.md` for the
  connection-string split (`DATABASE_URL` pooled vs `DIRECT_URL` unpooled) — this is a common
  silent-failure point, read it carefully before touching `schema.prisma`.
- **LLM:** Gemini free tier (primary) → Groq free tier (fallback on error/429). See
  `docs/03-agent-and-llm.md`.
- **Push:** Web Push + Firebase Cloud Messaging, via a real installable PWA, later wrapped with
  Bubblewrap into a TWA Android APK. See `docs/06-scheduling-and-notifications.md`.
- **WhatsApp (optional reminder channel):** Green API, same pattern already used on the Awaaz
  project.
- **Scheduling:** cron-job.org (free, external) hitting an authenticated `/api/cron/tick`
  endpoint on the backend at short intervals. See `docs/06-scheduling-and-notifications.md`.

## Repo layout (target)

```
/frontend          Next.js PWA
/backend           NestJS/Express API + agent/LLM router + tool-calling functions
/backend/prisma     schema.prisma, migrations
/docs               this plan (not shipped, reference only)
```

## Commands

```
# Backend (Express + TypeScript — chosen over NestJS: single-user app, no need
# for NestJS's DI/module ceremony; Express + a thin service layer keeps Phase 1
# lean. Prisma pinned to 6.x, not 7.x — Prisma 7 moved datasource url/directUrl
# out of schema.prisma into a separate prisma.config.ts, which doesn't match
# the documented schema.prisma pattern in docs/02-database-schema.md.)
cd backend && npm run dev              # ts-node-dev, http://localhost:4000
cd backend && npm run build && npm start
cd backend && npm test
cd backend && npm run prisma:migrate   # prisma migrate dev (uses DIRECT_URL)
cd backend && npm run prisma:deploy    # prisma migrate deploy (for CI/Render)
cd backend && npm run prisma:seed
cd backend && npm run prisma:studio

# Frontend (Next.js App Router, TypeScript, Tailwind v4 — Next 16, see
# frontend/AGENTS.md before assuming pre-16 API shapes)
cd frontend && npm run dev             # http://localhost:3000
cd frontend && npm run build
cd frontend && npm run lint
```

Env files: copy `backend/.env.example` → `backend/.env` and
`frontend/.env.local.example` → `frontend/.env.local`, then fill in real values
from `docs/00-human-setup-tasks.md`. Never commit either `.env` file.

## How to use the docs/ folder

Read in this order, once, before starting Phase 1:
1. `docs/01-data-model.md` — full entity spec (source of truth for what to build)
2. `docs/02-database-schema.md` — Prisma/Neon specifics and schema sketch
3. `docs/03-agent-and-llm.md` — chat agent behavior, tool-calling design, confirm-before-commit
4. `docs/04-workflows.md` — every business process (QA flow, blockers, reminders, etc.)
5. `docs/05-vault-and-security.md` — encryption, LLM-bypass mechanism, audit log
6. `docs/06-scheduling-and-notifications.md` — cron-job.org, FCM, digest, reminder delivery
7. `docs/07-frontend-design-system.md` — mobile-first design rules, avoiding AI-slop UI
8. `docs/08-testing-and-quality-gates.md` — what "done" means at each phase

Then work through `docs/phases/phase-1-foundation.md` through `phase-7-apk-packaging.md` in
order. Each phase file is self-contained: what to build, in what order, and its test gate.

## When you're unsure

Prefer asking (surfacing the ambiguity in your output) over guessing silently — this mirrors
the same "ask, don't guess" principle the app itself is built around.
