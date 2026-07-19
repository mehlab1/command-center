# Phase 4 — Dashboard (Eagle's-Eye View)

**Goal:** the read-only dashboard surfaces everything Mehlab needs to see at a glance, built to
the mobile-first design system, with real caching so navigation feels instant even given
free-tier cold-start realities.

## Prerequisites
- Phase 3 test gate passed.
- Read `docs/07-frontend-design-system.md` fully before starting any UI work in this phase.

## Tasks

1. **Projects panel.** Status, category filter, deadline sorting, and — specifically flagged
   as important by Mehlab — visible callouts for projects with zero tasks or zero *assigned*
   tasks.

2. **People panel.** Devs grouped by pod, Assigned/Unassigned computed status, and a capacity
   view (open task count per dev) so overload is visible at a glance.

3. **Tasks panel.** Kanban/table toggle (already functional from Phase 3, polish to final
   design here), filterable and sortable.

4. **QA panel.** Queue list with assignment status, clear visual distinction between
   Unassigned/Assigned/Passed/Sent Back.

5. **Deadlines radar.** What's due in 24h/1h windows and what's already overdue, pulling from
   the same logic that drives push notification timing (don't duplicate the "what's due soon"
   logic — factor it into a shared service method used by both the dashboard and the
   notification tick handler in Phase 6).

6. **Performance panel.** Per-dev current average rating + trend chart, on-time % + trend
   chart, sourced from `ratings_history`.

7. **Client-side caching.** Wire up React Query (or equivalent) so dashboard panels show
   cached data instantly on navigation and revalidate in the background, per `docs/07-
   frontend-design-system.md`.

## Test Gate — must all pass before Phase 5

- [ ] Every panel above renders real data from the actual database, not mocked/placeholder
      data.
- [ ] A project with zero tasks and a project with tasks-but-none-assigned are both visibly
      distinguishable on the dashboard.
- [ ] Dev capacity numbers update correctly when tasks are created/completed via chat in
      another session/tab.
- [ ] Navigating between dashboard panels feels instant on a warm backend (cached data shown
      immediately, background revalidation doesn't cause visible flicker/layout shift).
- [ ] Dashboard verified on an actual small-viewport Android browser, not just resized desktop.
- [ ] Rating trend chart correctly reflects multiple `ratings_history` entries over time for at
      least one test dev with 3+ rated tasks.
