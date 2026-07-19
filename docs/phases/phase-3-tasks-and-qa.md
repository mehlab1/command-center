# Phase 3 — Tasks, QA Queue, and Ratings

**Goal:** the full task lifecycle works via chat, including the deadline-miss hybrid logic,
blocked-task dual-field rule, the QA queue and send-back flow, and ratings with trend history.

## Prerequisites
- Phase 2 test gate passed.
- Read `docs/04-workflows.md` fully (Tasks, QA, Ratings, In-progress-edits sections).

## Tasks

1. **Task tools.** Implement `create_task`, `delete_task`, `mark_task_blocked`,
   `mark_task_done`. Deliberately do NOT implement a general task edit tool — per the golden
   rule, in-progress tasks are handled via delete+recreate, not editing.

2. **Deadline-miss hybrid logic.** Implement exactly the three-branch behavior in `docs/04-
   workflows.md` inside `mark_task_done` — this is a precise, specified business rule; write a
   unit test for each branch (on-time/no-question, late/asks, late/user-says-not-missed,
   late/user-confirms-missed).

3. **Blocked-task dual-field enforcement.** `mark_task_blocked` must reject any call missing
   either `blocker_description` or `revised_deadline` — enforce at the service layer, not just
   prompt-level, so it can't be bypassed by an unusual LLM output.

4. **QA queue.** Implement automatic `qa_queue_entries` creation when a `needs_qa = true` task
   is marked `DONE`. Implement `assign_qa_reviewer` (suggests default from `settings` but
   requires explicit confirmation) and `resolve_qa_entry` (pass/send-back).

5. **Send-back flow.** On send-back: mark the QA entry `SENT_BACK`, set
   `original_task.superseded_by_task_id` once the new task exists, and route into the normal
   `create_task` conversation with nothing pre-filled — verify this reuses the exact same task-
   creation code path as any fresh task, not a special variant.

6. **Ratings.** Implement `rate_task`, writing both `tasks.rating` and a new
   `ratings_history` row. Handle the multi-assignee case per the documented approach in
   `docs/04-workflows.md`.

7. **Task views (dashboard, minimal for now).** Kanban and table toggle view per
   `docs/07-frontend-design-system.md`, showing real data — doesn't need dashboard polish yet
   (that's Phase 4), but needs to be functional enough to verify task state changes visually.

## Test Gate — must all pass before Phase 4

- [ ] Create a task with `needs_qa = false`, mark it done before the deadline → no question
      asked, `missed_deadline = false`.
- [ ] Create a task, mark it done after the deadline → agent asks the missed-deadline
      question; both "yes" and "no" answers correctly set `missed_deadline`.
- [ ] Attempt to mark a task `BLOCKED` with only a blocker description and no revised deadline
      → rejected; providing both succeeds.
- [ ] Create a task with `needs_qa = true`, mark it done → a `qa_queue_entries` row is
      auto-created with `status = UNASSIGNED` and a suggested reviewer if one is set in
      `settings`.
- [ ] Resolve a QA entry as "sent back" → original task marked superseded, a brand-new task is
      created via the normal creation flow with no pre-filled assignees, `supersedes_task_id`
      correctly links back.
- [ ] Rate a completed task → `ratings_history` gets a new row (not an update to an existing
      one) with correct `on_time` value derived from `missed_deadline`.
- [ ] Attempt to "edit" an in-progress task → confirm the system has no such path; the correct
      user-facing flow (delete, then recreate) works and is reflected correctly in `audit_log`
      as two separate entries (DELETE then CREATE).
- [ ] Personal task (`is_personal = true`) with `needs_qa = true` goes through the identical QA
      flow as a dev task — no special-casing bugs.
