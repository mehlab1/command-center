# Phase 6 — Notifications & Reminders

**Goal:** real push notifications working end to end, the free cron-job.org scheduling
pattern wired up, the daily digest, custom reminders (standalone/linked, push/WhatsApp,
one-off/recurring), and event-driven pushes.

## Prerequisites
- Phase 5 test gate passed.
- Read `docs/06-scheduling-and-notifications.md` fully before starting.
- Firebase project and cron-job.org account already set up per `docs/00-human-setup-tasks.md`.

## Tasks

1. **Service worker push handling.** Extend the Phase 1 service worker to handle `push` and
   `notificationclick` events, with deep-linking into the relevant view on tap.

2. **FCM subscription flow.** Soft opt-in UI (explicit user action, not a hard prompt on load),
   subscription token sent to and stored by the backend.

3. **Firebase Admin SDK integration (backend).** Send notifications using the service account
   JSON from setup.

4. **`/api/cron/tick` endpoint.** Authenticated via `CRON_SECRET` bearer token. Implements:
   deadline-window checks (24h/1h/at-deadline, deduped via a notification-log or boolean-set
   approach per `docs/06-scheduling-and-notifications.md`), daily digest firing logic
   (comparing against `settings.daily_digest_time` with tolerance), and reminder/occurrence
   firing (`SCHEDULED` + `fire_time <= now` → send → mark `SENT`).

5. **cron-job.org configuration.** Set up the actual scheduled job hitting `/api/cron/tick`
   on a 5–10 minute interval (this step happens now, not in Phase 0, since the endpoint didn't
   exist until this phase).

6. **Reminders — full feature.** `create_reminder` and `cancel_reminder` tools supporting
   standalone (no task/project link) and linked reminders, single/recurring/explicit-list fire
   times (expanded to explicit occurrences at creation), and channel selection (`PUSH` default,
   `WHATSAPP` via Green API).

7. **Task-completion reminder prompt.** When `mark_task_done` runs and the task has
   `SCHEDULED` future reminders, prompt to cancel them per the exact behavior in `docs/04-
   workflows.md`.

8. **Event-driven pushes.** Fire immediately (not via the cron tick) from within the relevant
   service-layer action: task blocked, QA item lands in queue.

9. **Digest time setting.** Editable via chat (`update_setting`) or a dashboard settings
   screen — verify changing it actually reschedules future digest sends (no code deploy
   needed, just reads the current `settings` value each tick).

10. **Standalone reminders view.** Dedicated list in the dashboard/UI, since these have no
    parent entity to live under, per `docs/04-workflows.md`.

## Test Gate — must all pass before Phase 7

- [ ] Push notification received on an actual installed PWA on Mehlab's Android phone (browser
      install, not yet the TWA APK — that's Phase 7), including when the phone is locked.
- [ ] cron-job.org successfully triggers `/api/cron/tick` on schedule; unauthenticated requests
      to that endpoint are rejected.
- [ ] A task deadline crossing the 24h window fires exactly one notification (not repeated on
      every subsequent tick) — verify the dedup logic.
- [ ] Daily digest fires at the configured time; changing `settings.daily_digest_time` via chat
      correctly changes when the next digest fires.
- [ ] Create a recurring reminder ("5 reminders, 2 days apart") → correct number of
      `reminder_occurrences` created with correct spaced timestamps.
- [ ] Create a standalone reminder with no task/project link → fires correctly and appears in
      its own dashboard view.
- [ ] Override a reminder's channel to WhatsApp → message received via Green API.
- [ ] Mark a task done that has pending future reminders → agent asks about cancelling them;
      both "yes" and "no" paths behave correctly.
- [ ] Marking a task `BLOCKED` fires an immediate event-driven push, not delayed until the next
      cron tick.
