# Testing & Quality Gates

Every phase file in `docs/phases/` ends with a "Test Gate" section listing specific pass/fail
criteria. This doc defines the general testing approach those gates draw from.

## Layers of testing

1. **Unit tests** — service-layer business logic, especially the workflows in
   `docs/04-workflows.md` that have exact specified behavior (deadline-miss hybrid logic,
   blocked-task dual-field requirement, QA send-back creating a new task rather than reopening,
   pod-lead computed status, project deletion's two explicit paths). These are the highest-
   value tests in this codebase because the behavior is precisely specified — a test that
   verifies "marking done exactly on the deadline does not ask the missed-deadline question"
   is testing a real, deliberate business rule, not incidental behavior.
2. **Integration tests** — API endpoints against a real (test) Neon branch or a local Postgres
   instance, covering the confirm-before-commit flow end to end (propose → confirm → write →
   audit log entry created) and the QA queue lifecycle end to end.
3. **Agent/tool-calling tests** — since LLM output isn't fully deterministic, test the
   surrounding scaffolding deterministically: given a mocked LLM response with a specific tool
   call, does the confirm-before-commit orchestration behave correctly; given an ambiguous
   entity match, does the system correctly refuse to proceed and ask for disambiguation instead
   of calling a write tool. Don't try to unit-test "does Gemini understand natural language
   correctly" — that's not this codebase's job to guarantee; test that the harness around it
   behaves correctly regardless of what the LLM outputs.
4. **Manual smoke test** at the end of each phase — a short scripted walkthrough Mehlab (or
   Claude Code acting as a stand-in) runs through the actual deployed environment, not just
   local dev.

## Non-negotiable checks before any phase is marked complete

- No secrets committed to git (`git log -p | grep`-style check for anything that looks like a
  key/token, or better, confirm `.env*` was gitignored from the very first commit).
- `npx prisma migrate deploy` runs clean against the real Neon `DIRECT_URL` with no manual
  intervention.
- The app builds and deploys successfully to the actual free-tier targets (Render, Vercel), not
  just locally — a phase isn't "done" if it only works in local dev.
- No hardcoded model names/API assumptions that silently break if a free-tier limit or model
  availability changes — at minimum, config values, not hardcoded strings, for model
  identifiers.

## Production-readiness checklist (final gate before Phase 7 / APK packaging)

- [ ] Cold-start UX verified against the real deployed Render + Neon free-tier services (not
      simulated) — actually let both go idle and observe the real behavior.
- [ ] Confirm-before-commit verified for every entity type, including cancel/correction paths.
- [ ] Audit log verified to capture every write, with vault writes never leaking secret values
      into the log.
- [ ] Push notifications verified end-to-end on an actual installed PWA on Mehlab's Android
      device, not just in a desktop browser dev tools simulation.
- [ ] Daily digest fires at the configured time and reflects a change when the setting is
      edited.
- [ ] Custom reminders (standalone and linked, push and WhatsApp, one-off and recurring) tested
      for at least one case of each combination.
- [ ] All human setup tasks from `docs/00-human-setup-tasks.md` are complete and their
      credentials are correctly wired (no leftover placeholder values).
- [ ] Mobile-first UI verified on an actual small viewport, not just resized desktop browser.
- [ ] Vault secret bypass mechanism verified — inspect actual LLM API request payloads during a
      vault-creation flow to confirm no secret value appears in them.
