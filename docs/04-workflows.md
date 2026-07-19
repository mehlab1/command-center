# Business Workflows — Exact Behavior Specs

Every workflow below was explicitly worked out with Mehlab. Implement exactly this behavior,
not a "reasonable approximation."

## Deadline-miss detection (hybrid, not fully automatic)

When `mark_task_done` is called:
1. Compare `now` (completion timestamp) against `tasks.deadline`.
2. If `now <= deadline`: set `missed_deadline = false`. Do NOT ask the user anything — proceed
   silently.
3. If `now > deadline`: do NOT set `missed_deadline` yet. Ask the user: "This was completed
   after the deadline — should this count as a missed deadline?" Set `missed_deadline` based
   on their answer (accounts for legitimate scope changes/judgment calls).
4. `missed_deadline` feeds `ratings_history.on_time` when the task is later rated.

## Blocked tasks

Marking a task `BLOCKED` requires both `blocker_description` and `revised_deadline` in the
same call. Reject (at the tool/service layer, not just the UI) any attempt to set status to
`BLOCKED` with only one of the two present.

## QA queue

- QA-or-not is decided at task creation (`needs_qa` field), never changed later — consistent
  with "in-progress tasks are never edited."
- When a task's status transitions to `DONE` and `needs_qa = true`: automatically create a
  `qa_queue_entries` row, `status = UNASSIGNED`, `suggested_reviewer_dev_id` populated from
  `settings.default_qa_reviewer_dev_id` if set.
- If `needs_qa = false`: task is simply done, no QA entry, nothing further happens.
- Assignment: the agent may suggest the default reviewer, but assignment to
  `assigned_reviewer_dev_id` always requires an explicit user action/confirmation — never
  auto-assigns.
- **Passed:** `qa_queue_entries.status = PASSED`. Task remains `DONE`. Nothing else changes.
  Task becomes ratable if not already rated.
- **Sent Back:**
  1. `qa_queue_entries.status = SENT_BACK`, `resolved_at` set, `outcome_notes` captured.
  2. Original task: `superseded_by_task_id` set once the new task exists (see next step);
     original task's own status is untouched (stays `DONE` for historical record — it is not
     reopened, per the explicit "no editing in-progress tasks" rule and the confirmed design
     that a send-back creates a NEW task rather than reopening the old one).
  3. A brand-new task is created through the **normal task-creation conversation flow** — same
     as any fresh `create_task` call. Nothing pre-fills: not assignees, not description, not
     deadline. Mehlab decides fresh each time (same dev(s), different dev, additional dev,
     whatever fits). The only automatic link is `new_task.supersedes_task_id = original.id`
     (set server-side once the new task is created, purely for traceability — the agent does
     not need to ask about this field).
- **Personal tasks and QA are fully unified.** If `is_personal = true` and `needs_qa = true`,
  the exact same QA queue flow applies — no special-casing.

## Ratings

- After a task is `DONE` (and `PASSED` QA if it required QA), it becomes ratable.
- Rating is 1–5 stars, written to `tasks.rating` AND inserted as a new row in
  `ratings_history` (dev_id, task_id, rating, on_time derived from `missed_deadline`,
  created_at). Never update an existing `ratings_history` row — always insert.
- If a task has multiple assignees, prompt for a rating per dev (a shared task doesn't imply a
  shared score) — use judgment on whether to ask this as one combined prompt ("rate Ehsan's
  and Habiba's work on this — same score or different?") vs two separate prompts; either is
  acceptable, document whichever is chosen.

## In-progress task edits

**There is no edit path for tasks with any status other than allowed transitions
(`TODO→IN_PROGRESS`, `→DONE`, `→BLOCKED`).** If the user wants to change assignees, deadline,
description, etc. on a task that's already `IN_PROGRESS`, the correct flow is: delete the
existing task (standard confirm-before-delete flow, logged to `audit_log` as a `DELETE`) → then
create a new one via the normal `create_task` conversation (logged as a `CREATE`). Do not build
a `PATCH`/edit endpoint for task content fields beyond status transitions.

## Projects

- Status (`ACTIVE`/`ON_HOLD`/`COMPLETED`/`CANCELLED`) is set manually via chat, never derived.
- **Deletion — two explicit paths, both must be supported and the agent must always ask which
  one is intended if not specified:**
  - "Delete this project and all its tasks" → cascade: delete the project and every task whose
    `project_id` points to it. Show the task count before confirming (destructive).
  - "Delete this project but keep the tasks" → delete the project, set
    `tasks.project_id = null` for every task that referenced it (they become standalone).

## Devs and pods

- A dev is only "a lead" if `pods.lead_dev_id` points to them — this is computed, not a stored
  flag (see `docs/01-data-model.md`). Reassigning a pod's lead automatically demotes the old
  lead with no separate "unset lead" step.
- Moving a dev between pods ("move Habiba to Ali's pod") is a general operation available for
  any dev at any time — just update `devs.pod_id`, standard confirm flow.
- Deleting a dev who has open (non-`DONE`) tasks assigned: agent must warn and ask what to do
  with those tasks (reassign now to someone else, or leave the task with no assignee/orphaned)
  rather than silently deleting the dev and leaving dangling references.

## Reminders

- Two flavors: linked (`linked_task_id` or `linked_project_id` set) or fully standalone (both
  null, `message` required).
- Creation supports: single fire time, recurring (interval × count, expanded into explicit
  occurrence timestamps at creation time), or an explicit list of specific dates/times.
- Channel per reminder: `PUSH` (default) or `WHATSAPP` (via Green API, same integration
  pattern as Awaaz's WhatsApp confirmations).
- Automatic deadline-window reminders (24h/1h/at-deadline, see `docs/06-scheduling-and-
  notifications.md`) are separate from user-created custom reminders and always fire
  independently — creating a custom reminder on a task never suppresses the automatic ones.
- **Task completion interaction:** when a task is marked `DONE` and it has any `SCHEDULED`
  reminders with future fire times, the agent must ask: "This task has N upcoming reminders —
  cancel those too?" Yes → set those reminders' status to `CANCELLED`. No → leave them
  `SCHEDULED`, they will still fire regardless of the task being done.
- Cancellation via chat: "cancel the reminders on that task" / "cancel my Friday reminder
  about X" — resolve via the same disambiguation rules as everything else.

## Daily digest

- Fires once per day at `settings.daily_digest_time` (default e.g. `08:00`, user-editable via
  chat or dashboard settings — changing it just updates the `settings` row, no code deploy
  needed).
- Content: what's due today, what's overdue, what's unassigned (devs with no open task,
  projects with no tasks or no assigned tasks, unassigned QA queue entries).

## Universal confirm-before-commit

Restated here because it governs every workflow above: no DB write happens without an explicit
plain-language confirmation step first, and every completed write is logged to `audit_log`
with a summary, a source (`CHAT` or `DASHBOARD`), and a diff where applicable.
