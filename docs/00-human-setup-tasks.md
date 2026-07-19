# Human Setup Tasks — Do These BEFORE Claude Code Starts Building

Per the golden rule of batching human tasks, everything Mehlab needs to do personally before
any code depends on it lives here. Do all of these first, in order, then hand the resulting
credentials to Claude Code as environment variables. Nothing in this list requires payment.

## 1. Neon (database)
1. Create a free account at neon.tech.
2. Create a new project (e.g. `finova-command-center`).
3. From the Neon dashboard, copy **two** connection strings:
   - Pooled connection (hostname contains `-pooler`) → this becomes `DATABASE_URL`
   - Direct/unpooled connection (no `-pooler`) → this becomes `DIRECT_URL`
4. Keep both handy — Claude Code will need both in `backend/.env`.

## 2. Render (backend hosting)
1. Create a free account at render.com, connect it to the GitHub account/repo you'll use.
2. Do NOT create the Web Service yet — Claude Code will guide the exact config once the
   backend code exists. Just have the account ready and connected to GitHub.

## 3. Vercel (frontend hosting)
1. Create a free account at vercel.com, connect it to the same GitHub account.
2. Same as Render — account + GitHub connection ready, actual project import happens later.

## 4. Google Gemini API (primary LLM)
1. Go to Google AI Studio (aistudio.google.com).
2. Generate a free API key.
3. Note the free-tier rate limits shown at generation time (requests/minute, requests/day) —
   give these to Claude Code so it can size the fallback/retry logic correctly.

## 5. Groq API (fallback LLM)
1. Create a free account at console.groq.com.
2. Generate a free API key.

## 6. Firebase project (push notifications)
1. Create a free Firebase project at console.firebase.google.com.
2. Enable **Cloud Messaging** in the project.
3. Generate a **Web Push certificate (VAPID key pair)** under Project Settings → Cloud
   Messaging → Web configuration.
4. Download the Firebase service account JSON (Project Settings → Service Accounts →
   Generate new private key) — needed for the backend to send pushes.
5. Note the Firebase project's `apiKey`, `projectId`, `messagingSenderId`, `appId` (from
   Project Settings → General → Your apps → Web app) — needed for frontend FCM registration.

## 7. cron-job.org (free external scheduler)
1. Create a free account at cron-job.org.
2. Don't create the actual scheduled job yet — that happens once the backend's
   `/api/cron/tick` endpoint exists and has a secret token to authenticate against. Just have
   the account ready.

## 8. Green API (WhatsApp reminders — optional channel)
1. Since Awaaz already uses Green API, reuse the existing account/instance if it has spare
   capacity, or create a new free instance specifically for this app to keep concerns separate
   (Mehlab's call — flag this decision point rather than assuming).
2. Note the `idInstance` and `apiTokenInstance` for whichever instance is used.

## 9. Domain / hosting decision for the PWA
1. Decide whether the app lives on a subdomain of `finovasolutions.tech` (e.g.
   `command.finovasolutions.tech`) or on Vercel's free `*.vercel.app` domain. A TWA/APK build
   later requires the domain to be stable and to support Digital Asset Links verification, so
   this should be decided now rather than after the APK step (switching domains later means
   redoing the TWA verification). If using a `finovasolutions.tech` subdomain, make sure DNS
   access is available.

## 10. Android device for testing
1. Have the actual Android phone Mehlab will install the final APK on available and ready
   (for enabling "install from unknown sources" or sideloading later — no action needed yet,
   just confirming device access).

---

**Deliverable from this phase:** a single secure note (not committed to git) containing every
credential above, ready to paste into `backend/.env` and `frontend/.env.local` once Claude
Code scaffolds those files in Phase 1.
