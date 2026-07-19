# Data Model — Source of Truth

This is the authoritative entity spec. `docs/02-database-schema.md` translates this into a
Prisma sketch; you finalize exact types/indexes there. If anything here seems to conflict with
a workflow described in `docs/04-workflows.md`, the workflow doc wins for *behavior*, this doc
wins for *shape*.

## Core rule reminders that affect the schema
- Every create/edit/delete goes through confirm-before-commit and gets logged to `audit_log`.
- No recurring tasks. Ever. (Reminders can recur; tasks cannot.)
- In-progress tasks are never edited — they're deleted and recreated. Plan for a clean, simple
  task model; don't build versioning/history fields onto `tasks` itself for this reason.
- A dev's "Assigned/Unassigned" status is **computed** (has ≥1 open task), never stored.
- A dev's "lead" status is **computed** from whether they currently own a pod, never stored as
  an independent boolean that could drift out of sync.

## `projects`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| name | string | required |
| description | text | optional |
| category | string | e.g. "Client — X", "Internal", "Personal"; free text is fine, no enum needed |
| status | enum | `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| deadline | timestamp | nullable |
| created_at / updated_at | timestamp | |

## `devs`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| name | string | required |
| designation | string | free text |
| employment_type | enum | `PERMANENT`, `INTERN` |
| internship_end_date | timestamp | nullable, informational only, no automated alert |
| pod_id | uuid nullable | FK → `pods.id`. Presence of `pods.lead_dev_id == this dev` (not this
  field) is what determines lead status — see below. |
| created_at / updated_at | timestamp | |

> **Do not store `is_lead` as a column.** Compute it at query time as
> `EXISTS(SELECT 1 FROM pods WHERE lead_dev_id = dev.id)`. Same for `status` (Assigned/
> Unassigned) — compute from `EXISTS(SELECT 1 FROM tasks WHERE status != 'DONE' AND
> dev.id = ANY(assignee_dev_ids))`. Storing these as columns risks drift; compute them in the
> API layer (a service method or SQL view) instead.

## `pods`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| name | string | required |
| lead_dev_id | uuid | FK → `devs.id`, required, one pod = exactly one lead |
| created_at / updated_at | timestamp | |

Membership: `devs.pod_id` is the join — a dev belongs to at most one pod at a time (strict,
confirmed). The lead is *also* typically a member of their own pod's roster for display
purposes — decide in implementation whether `lead_dev_id`'s dev row also needs `pod_id` set to
the same pod (recommended: yes, keep it consistent so "who's in this pod" queries are simple).

Reassigning a lead: changing `pods.lead_dev_id` to a different dev automatically changes who
is "a lead" — nothing else needs to update. If the old lead isn't given a new pod, they simply
have `pod_id = null` and are no longer a lead (computed fact, not a manual unset).

## `tasks`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| title | string | required |
| description | text | long-form, optional |
| notes | text | short/quick field, optional, distinct from description |
| project_id | uuid nullable | FK → `projects.id`, optional link |
| is_personal | boolean | true if this is "assigned to Mehlab" rather than a dev task |
| status | enum | `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED` |
| deadline | timestamp | required |
| blocker_description | text | nullable; required together with `revised_deadline` when
  status transitions to `BLOCKED` — enforce both-or-neither at the application layer |
| revised_deadline | timestamp | nullable; set alongside `blocker_description` |
| missed_deadline | boolean | nullable; set per the hybrid logic in `docs/04-workflows.md` §
  Deadline-Miss Detection — null until resolved, then true/false |
| needs_qa | boolean | set at task creation, not editable later (in-progress tasks aren't
  edited — see golden rule) |
| superseded_by_task_id | uuid nullable | FK → `tasks.id`, set when a QA send-back spawns a
  replacement |
| supersedes_task_id | uuid nullable | reverse pointer for history display, denormalized for
  query convenience |
| rating | int nullable | 1–5, set once after Done (+ QA pass if applicable) |
| completed_at | timestamp | nullable, set when status → `DONE` |
| created_at / updated_at | timestamp | |

## `task_assignees` (join table)
| field | type | notes |
|---|---|---|
| task_id | uuid | FK → `tasks.id` |
| dev_id | uuid | FK → `devs.id` |

Composite PK `(task_id, dev_id)`. Supports the confirmed "2 devs on one task" case.

## `qa_queue_entries`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| task_id | uuid | FK → `tasks.id`, one entry per Done+needs_qa task |
| status | enum | `UNASSIGNED`, `ASSIGNED`, `PASSED`, `SENT_BACK` |
| suggested_reviewer_dev_id | uuid nullable | auto-suggested default QA reviewer, informational
  only — never auto-commits an assignment |
| assigned_reviewer_dev_id | uuid nullable | who's actually reviewing (Mehlab or a dev) |
| outcome_notes | text | nullable |
| created_at / resolved_at | timestamp | |

## `ratings_history`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| dev_id | uuid | FK → `devs.id` |
| task_id | uuid | FK → `tasks.id` |
| rating | int | 1–5 |
| on_time | boolean | snapshot of `tasks.missed_deadline` (inverted) at time of rating |
| created_at | timestamp | |

Append-only — never update a row here, always insert a new one. This is what powers trend
charts (rating over time, on-time % over time).

## `vault_items`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| name | string | required |
| folder | string | broad category |
| tags | string[] | for cross-cutting search |
| secret_value_encrypted | bytea/text | AES-256-GCM ciphertext, see `docs/05-vault-and-security.md` |
| notes | text | non-sensitive context, may be chat-authored |
| file_attachment_url | string nullable | pointer to encrypted stored file |
| created_at / updated_at | timestamp | |

## `reminders`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| linked_task_id | uuid nullable | FK → `tasks.id` |
| linked_project_id | uuid nullable | FK → `projects.id` |
| message | text | required if standalone (no task/project link), otherwise
  auto-generated but overridable |
| channel | enum | `PUSH` (default), `WHATSAPP` |
| fire_times | timestamp[] | one or more explicit timestamps — for recurring reminders,
  expand interval × count into explicit rows at creation time rather than storing a cron
  expression (simpler to reason about, simpler to cancel individual occurrences) |
| status | enum | `SCHEDULED`, `SENT`, `CANCELLED` |
| created_at | timestamp | |

> Note: since `fire_times` is an array but each occurrence needs independent
> sent/cancelled tracking, consider normalizing this into a `reminder_occurrences` child table
> (`reminder_id`, `fire_time`, `status`) instead of an array with parallel status tracking.
> Recommended if the array-of-status approach gets awkward — use judgment during Phase 2.

## `audit_log`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| action_type | enum | `CREATE`, `EDIT`, `DELETE` |
| entity_type | string | e.g. `task`, `project`, `dev`, `pod`, `vault_item`, `reminder` |
| entity_id | uuid | |
| summary | text | the plain-language confirmation text that was shown to Mehlab |
| diff | jsonb | structured before/after, nullable for CREATE |
| source | enum | `CHAT`, `DASHBOARD` |
| created_at | timestamp | |

## `chat_messages`
| field | type | notes |
|---|---|---|
| id | uuid | pk |
| role | enum | `USER`, `AGENT` |
| content | text | |
| linked_entity_ids | uuid[] | nullable, for cross-referencing |
| created_at | timestamp | |

## `settings`
| field | type | notes |
|---|---|---|
| key | string | pk, e.g. `daily_digest_time` |
| value | string | |

Single-row-per-key config store. Start with `daily_digest_time` (default e.g. `08:00`,
user-editable per the confirmed requirement) and `default_qa_reviewer_dev_id`.
