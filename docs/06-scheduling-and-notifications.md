# Scheduling & Notifications

## Why not Render Cron Jobs

Render's own Cron Jobs feature is a separately billed service type (minimum $1/month per cron
job) — this is NOT covered by the free Web Service tier and violates the zero-cost requirement.
Do not use it.

## The free scheduling pattern: cron-job.org → `/api/cron/tick`

1. Build a single authenticated backend endpoint: `POST /api/cron/tick`, protected by a shared
   secret (e.g. a bearer token stored as `CRON_SECRET` in Render's environment variables, sent
   as a header by cron-job.org's configured request).
2. This endpoint, on each invocation, checks what's due right now:
   - Any `reminders`/`reminder_occurrences` with `status = SCHEDULED` and `fire_time <= now`
     → send via the appropriate channel (push or WhatsApp) → mark `SENT`.
   - Any tasks/projects/QA entries crossing the 24h/1h/at-deadline windows → send the
     corresponding automatic push (dedupe so the same window doesn't fire twice — track
     "last notified tier" per task/project, e.g. a small `notified_24h`, `notified_1h`,
     `notified_at_deadline` boolean set, or a more general notification-log table keyed by
     entity+tier).
   - If it's time for the daily digest (compare current time against `settings.
     daily_digest_time`, allowing a small tolerance window matching the tick interval)
     → compose and send the digest push.
3. Configure a free cron-job.org job to hit this endpoint on a short interval — every 5 or 10
   minutes is reasonable given the reminder granularity Mehlab wants (down to specific times,
   not just days). A tighter interval gives more precise firing but isn't necessary beyond
   matching the smallest reminder granularity in practice.
4. **Side benefit, not the primary purpose:** this ping cadence also keeps the Render backend
   from going fully cold-idle during the hours it's configured to run, which reduces (but does
   not eliminate) cold-start latency on Mehlab's own interactive use of the app. Do not treat
   this as a guaranteed always-warm solution — still build the frontend cold-start handling
   described in `docs/02-database-schema.md` and `docs/07-frontend-design-system.md`
   regardless.

## Push notifications (Web Push + FCM)

1. Frontend must be a genuine installable PWA from the start: a valid `manifest.json`
   (name, icons at multiple sizes, `display: standalone`, theme colors) and a registered
   service worker (`sw.js` or similar) that handles `push` and `notificationclick` events.
2. On first meaningful app use, prompt the user (soft opt-in — triggered by an explicit action
   like tapping "enable notifications" in settings, not a hard browser prompt on page load) to
   subscribe via `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey:
   <VAPID public key> })`.
3. Send the resulting subscription (or FCM token, depending on whether you go through raw Web
   Push or Firebase's SDK wrapper — using Firebase's SDK is simpler for token management, use
   it) to the backend and store it (a simple `push_subscriptions` table or a column on
   `settings`, since there's only one user/device realistically, though supporting multiple
   registered devices for the same user is a reasonable and cheap addition).
4. Backend sends notifications via the Firebase Admin SDK using the service account JSON from
   `docs/00-human-setup-tasks.md`.
5. Service worker's `notificationclick` handler should deep-link into the relevant view (e.g.
   tapping a task-deadline notification opens that task).

## Android background delivery — do this correctly the first time

A bare "convert my website to an APK" WebView wrapper does NOT reliably deliver background
push on Android — this is a common trap. The correct free path:
1. Build and deploy the PWA properly (steps above) first, fully working in a mobile browser,
   installable via "Add to Home Screen," with push notifications confirmed working in that
   context.
2. Only once that's verified, use **Bubblewrap** (Google's official, free, open-source CLI) to
   generate a Trusted Web Activity (TWA) Android project from the deployed PWA URL. A TWA runs
   the PWA inside Chrome's engine with full access to service workers and push — unlike a
   WebView wrapper.
3. This requires Digital Asset Links verification (a JSON file served from
   `/.well-known/assetlinks.json` on the PWA's domain, linking it to the Android app's signing
   key) — this is why the domain decision in `docs/00-human-setup-tasks.md` needs to be settled
   before this step, since changing domains later means redoing this verification.
4. `bubblewrap build` produces the installable APK. Sideload it onto Mehlab's Android device
   for testing (this is a `docs/99-human-final-tasks.md` item, not something Claude Code does
   remotely).

## Notification types summary

| Type | Trigger | Timing |
|---|---|---|
| Deadline warning | project/task/QA-entry deadline approaching | 24h before, 1h before, at deadline moment |
| Daily digest | scheduled | once/day at `settings.daily_digest_time`, user-editable |
| Event-driven | task blocked, QA item lands in queue, etc. | immediate, fired directly from the relevant service-layer action (not via the cron tick — these fire the moment the triggering write happens) |
| Custom reminder | user-created via chat or standalone | per `reminders`/`reminder_occurrences`, checked each cron tick |

Note the distinction: deadline warnings and the daily digest are **polled** by the cron tick
(since they depend on comparing current time to stored values), while event-driven pushes
(blocked, QA queue arrival) should fire **immediately** from within the same request that made
the underlying change — don't wait for the next tick for these.
