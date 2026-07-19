# Frontend Design System — Mobile-First, Not AI-Slop

Read this before writing any UI code. Also read `/mnt/skills/public/frontend-design/SKILL.md`
if available in your environment — it contains the same underlying design discipline this doc
applies specifically to this product.

## Explicitly avoid these AI-generated-design tells

Do not default to any of these unless there's a specific reason tied to this product:
- Warm cream background (~#F4F1EA) + high-contrast serif + terracotta/clay accent
  (~#D97757) — this specific combination reads as "made by Claude" and should be avoided here.
- Near-black background with one bright acid-green or vermilion accent as the *only* palette
  idea considered.
- Broadsheet/newspaper layout with hairline rules, zero border-radius, dense columns, applied
  reflexively rather than because it fits a management-dashboard product.
- Generic numbered markers (01/02/03) used as decoration rather than because the content is
  genuinely sequential.
- Excessive scroll-triggered animation or motion for its own sake — a management tool used
  daily should feel fast and calm, not like a landing page.

## What this product actually is, and what that implies for design

A **daily-use internal command center** for a technical founder managing people, deadlines,
and sensitive credentials, primarily on a phone. This is closer in spirit to a well-built
project-management or fintech-ops tool than a marketing site. Implications:
- Optimize for scan-speed and one-thumb operation, not first-impression wow.
- Information density matters — Mehlab will check this dashboard many times a day; don't
  waste vertical space on decorative hero sections inside the app itself (a marketing/landing
  page, if one is ever built, is a different surface — the app itself is a tool, not a pitch).
- Status (deadlines, QA states, blocked tasks) needs to be legible at a glance — color and
  iconography carry real information here, not just decoration. Build a genuine semantic color
  system (e.g. distinct, accessible colors for To Do / In Progress / Done / Blocked, and for
  on-time vs overdue) and use it consistently everywhere those states appear.

## Design process (do this before writing component code)

1. **Define a real token system** before touching Tailwind config defaults: 4–6 named colors
   (including the semantic status colors above), a type scale using two typefaces (one for
   headings/data emphasis, one for body — pick something with real character suited to a
   technical/ops tool, not a generic system-font default), spacing scale, and border-radius
   scale. Write these down in `frontend/DESIGN_TOKENS.md` before implementing.
2. **Pick a signature element** — one thing this app is memorable for visually. Given the
   subject matter (managing devs, pods, tasks, deadlines — inherently relational, flow-based
   data), consider something like a distinctive way of visualizing pod/dev relationships or
   task flow, rather than a decorative flourish unrelated to the content. Spend the one "bold"
   choice here; keep the rest of the UI disciplined and quiet around it.
3. **Self-critique against the three AI-slop patterns above** before building — if the token
   plan resembles any of them, revise and note what changed and why.

## Mobile-first build order (literal build order, not just a philosophy)

1. Design and build every screen at a 375–414px viewport width first.
2. Only after the mobile layout is solid, add responsive breakpoints to scale up to
   tablet/desktop — never the reverse.
3. Bottom-anchored primary navigation (thumb-reachable), not a top hamburger-only pattern, for
   the core sections (Dashboard, Chat, Tasks, QA, Vault, Reminders).
4. The chat interface itself should feel native to mobile messaging patterns (message bubbles,
   sticky input bar above the keyboard, clear distinction between agent confirmation prompts
   and normal responses — confirmation prompts should be visually distinct, e.g. a card with
   explicit Confirm/Cancel buttons rather than just more chat text, so Mehlab never accidentally
   confirms something by misreading plain text as already-committed).

## Handling Render/Neon cold starts in the UI (required, not optional polish)

Since cold starts are a real, accepted constraint (see `docs/02-database-schema.md`), the
frontend must never show a blank screen, a raw error, or an infinite spinner with no
explanation on a cold-start delay. Specific requirement:
- Any request that's taking unusually long (e.g. >3s) on first load of a session should switch
  to a friendly "waking things up — this happens after a bit of inactivity, just a few more
  seconds" state, not a generic spinner.
- Once the backend responds, subsequent requests in the same session should feel instant —
  don't re-show the wake-up message for fast follow-up requests.

## Caching

- Use client-side caching (e.g. React Query / TanStack Query) for dashboard data so navigating
  between views doesn't always trigger a fresh cold-start-prone round trip — show cached data
  immediately, revalidate in the background.
- Service worker (already required for PWA/push support) can also cache static assets and the
  app shell for instant repeat loads, standard PWA practice.

## Accessibility & quality floor (non-negotiable baseline, not a stretch goal)

- Visible keyboard focus states throughout.
- Color is never the only signal for status — pair with an icon or label, since color alone
  fails for any accessibility need and also just reads as more polished in a dense dashboard.
- Respect `prefers-reduced-motion`.
- Responsive correctness down to small phone widths, verified by actually resizing/testing,
  not assumed.

## Copy/microcopy tone

Match the register described in the frontend-design skill: plain verbs, sentence case, name
things by what Mehlab controls ("Reminders," not "Notification Webhooks"), consistent verb
choice through a flow (a button that says "Confirm" should lead to a message that says
"Confirmed," not "Success!"), and empty states that read as an invitation to act ("No tasks
yet — tell the agent about your first one") rather than a flat "No data."
