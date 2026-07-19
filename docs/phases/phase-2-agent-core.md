# Phase 2 — Agent Core

**Goal:** the chat agent can create/edit/delete Projects, Devs, and Pods end to end, with the
full confirm-before-commit + disambiguation + audit-log + chat-history loop working correctly.
Tasks/QA/Vault/Reminders come in later phases — this phase proves the *pattern* works on the
three simplest entities before it's reused everywhere else.

## Prerequisites
- Phase 1 test gate passed.
- Read `docs/03-agent-and-llm.md` and `docs/04-workflows.md` (Devs/Pods sections) fully before
  starting.

## Tasks

1. **LLM router.** Implement `llmRouter.chat(messages, tools)` with Gemini primary, Groq
   fallback on error/429, per `docs/03-agent-and-llm.md`. Keep model identifiers in config, not
   hardcoded.

2. **Tool definitions for Projects/Devs/Pods.** Implement `create_project`, `edit_project`,
   `delete_project`, `create_dev`, `edit_dev`, `delete_dev`, `reassign_dev_pod`, `create_pod`,
   `edit_pod`, `reassign_pod_lead`, plus the read/search tools needed for entity resolution.
   Each tool calls the backend's own service-layer functions (not raw SQL from the LLM layer).

3. **Confirm-before-commit orchestration.** Build this as a general, reusable orchestration
   layer (not per-entity duplicated logic) implementing the exact loop in `docs/03-agent-and-
   llm.md`: extract → disambiguate-or-ask → summarize → wait for confirm → write → audit log →
   store chat history.

4. **Disambiguation matching.** Implement the exact/case-insensitive/fuzzy-threshold matching
   strategy described in `docs/03-agent-and-llm.md` (Postgres `pg_trgm` is a reasonable choice)
   for resolving dev/project/pod names mentioned in chat.

5. **Computed fields.** Implement dev "lead" status and "assigned/unassigned" status as
   computed values (service method or SQL view), never stored columns, per `docs/01-data-
   model.md`.

6. **Chat UI.** Build the mobile-first chat interface per `docs/07-frontend-design-system.md`
   — message bubbles, sticky input, and visually distinct confirmation-prompt cards with
   explicit Confirm/Cancel buttons (not just more chat text).

7. **Audit log + chat history views (minimal).** A simple list view of `audit_log` and
   `chat_messages` — doesn't need to be polished yet, just functional, so the test gate below
   can verify entries are actually being written correctly.

## Test Gate — must all pass before Phase 3

- [ ] Via chat: create a project → correct confirmation summary shown → confirm → project
      exists in DB → `audit_log` row created with correct `source = CHAT`.
- [ ] Via chat: create a dev, assign as lead of a new pod → dev's computed lead status is true
      → reassign the pod's lead to someone else → original dev's computed lead status is now
      false, with no manual "unset" step required.
- [ ] Via chat: reference a dev name that doesn't exist / is ambiguous → agent asks for
      disambiguation → does NOT create a duplicate or guess.
- [ ] Via chat: start a delete flow, then cancel at the confirmation step → nothing is written,
      no audit log entry created.
- [ ] Gemini rate-limit or error simulated → Groq fallback engages and the user-facing
      interaction still completes successfully.
- [ ] `chat_messages` contains the full raw exchange for at least one completed and one
      cancelled flow.
- [ ] Moving a dev between pods works via natural language ("move X to Y's pod") and updates
      correctly.
