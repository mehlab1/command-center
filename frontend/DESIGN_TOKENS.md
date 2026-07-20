# Design Tokens — FinovaSolutions Command Center

Read `docs/07-frontend-design-system.md` and the `frontend-design` skill before changing any
of this. This is a daily-use ops tool for one person on a phone, not a marketing surface —
tokens optimize for scan-speed and legible status, not first-impression wow.

## Why this is a rewrite, not a v1

The first pass (indigo accent `#4C4FE0`, Space Grotesk + Inter, 6–16px soft radii, light
slate/ink surfaces) technically avoided the three named clichés in `docs/07` — but it landed on
a *fourth* generic default: "geometric-sans heading + Inter body + indigo/violet accent on a
soft light card" is the templated look of most AI-scaffolded SaaS dashboards right now, not a
choice made for this specific brief. Nothing in it came from who Mehlab is (a technical
founder) or what this tool actually is (an ops console, not a generic CRUD app). That's the
mistake this rewrite corrects.

## Grounding the choice in the actual subject

Mehlab is a CTO who spends his day in terminals, CI pipelines, and git history. "Command
Center" is not a metaphor he'll need explained — it's the vernacular he already lives in. The
distinctive choices below come from that world: terminal phosphor color, CI pass/fail
semantics, fixed-width status tags, monospace numerals — not from "what does a nice dashboard
look like."

## Color

Six named colors. Dark is the designed-for default (this is where Mehlab actually works), light
is a fully realized equal mode, not an afterthought — both defined as CSS custom properties,
dark values in `:root`, light overrides under `prefers-color-scheme: light` (inverted from the
usual light-default convention, deliberately, to match how this tool is actually used).

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--ink` | `#0E1116` | `#F4F6F8` | app background — graphite, not pure black; cool grey-blue, not cream |
| `--paper` | `#171B21` | `#FFFFFF` | cards, sheets, raised surfaces |
| `--text` | `#E7EAEE` | `#12161C` | primary text |
| `--text-muted` | `#8A94A3` | `#5B6472` | secondary text, timestamps, meta |
| `--line` | `#262B33` | `#DDE2E8` | hairline borders/dividers — structural, not decorative (see Layout) |
| `--signal` | `#E8A33D` | `#B87415` | the one interactive accent — terminal-amber, not indigo |

Semantic status — four states + two rating states, distinct from `--signal` so status color
always means status, never "clickable":

| Token | Value | Meaning |
|---|---|---|
| `--todo` | `#6B7684` | To Do |
| `--in-progress` | `#E8A33D` (= `--signal`) | In Progress — amber reads as "active," same convention as a build running |
| `--done` | `#3FA873` | Done / on-time |
| `--blocked` | `#D6564B` | Blocked / overdue |

Why amber (not indigo, not acid-green-on-black): amber phosphor is the actual historical color
of ops-console and terminal displays — it's the one accent color that's *about* this subject
rather than borrowed from generic SaaS branding. Using it for both "the one interactive accent"
and "in progress" is deliberate, not a shortcut: an amber UI element reads as "live/active," the
same thing an amber status means.

**Color is never the only signal** — every status renders as a fixed-width bracketed tag with
text, not a bare dot (this is also the signature element — see below).

## Type

Two faces from one coherent technical family — IBM Plex was designed by IBM specifically as the
typeface for their software and developer tooling, which is exactly the register this app wants
(and is not the geometric-sans-plus-Inter pairing every third AI-scaffolded app reaches for).

- **IBM Plex Mono** — screen titles, section headers, and all data-emphasis: deadlines, dates,
  ratings, counts, timestamps, IDs. Numerals align in a monospace grid, which is not a cosmetic
  choice for a dashboard full of numbers — it's why dates and countdowns won't visually jitter
  as they update.
- **IBM Plex Sans** — body copy, buttons, form fields, chat text, nav labels. Same design
  family as the mono face (coherent, not an arbitrary pairing), more legible than Plex Mono at
  small sizes for prose.

Scale (rem, mobile baseline, reused at desktop):

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 0.75rem | timestamps, meta, bracket tags |
| `--text-sm` | 0.875rem | secondary body, form labels |
| `--text-base` | 1rem | primary body, chat text |
| `--text-lg` | 1.125rem | card titles |
| `--text-xl` | 1.375rem | section headers (Plex Mono) |
| `--text-2xl` | 1.75rem | screen titles (Plex Mono) |

## Spacing

Unchanged from v1 — this wasn't the problem. 4px base unit, `--space-1` (4px) through
`--space-12` (48px), matching Tailwind's default numeric scale.

## Radius

Tightened from v1's 6–16px "soft app" scale to something that reads as an instrument panel, not
a consumer app — still never `0` (that's the broadsheet cliché), but noticeably crisper:

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 3px | inputs, buttons, bracket tags |
| `--radius-md` | 6px | cards |
| `--radius-lg` | 10px | sheets, the confirmation card |

## Layout: hairlines are structural, not decorative

`docs/07` explicitly bans "broadsheet layout with hairline rules... applied reflexively." The
distinction is *why* they're there. This app uses `--line` dividers to separate rows in dense
lists (tasks, audit log, chat) because "information density matters — Mehlab will check this
dashboard many times a day" (docs/07's own words) — the hairlines are doing real work
demarcating scannable rows in a data-dense tool, not imitating a newspaper for its own sake.
There is no dense multi-column text layout anywhere, no serif, no zero-radius cards.

## Signature element: the bracket status tag

Every status anywhere in the app — task status, project status, QA outcome, dev
assigned/unassigned, on-time/overdue — renders through one recurring device: a fixed-width,
monospace, bracketed tag.

```
[ DONE ]   [ WIP  ]   [ BLKD ]   [ TODO ]
```

Rationale, checked against the skill's "spend the one bold choice" guidance: this isn't a
one-screen flourish (a diagram that only lives on the dashboard) — it's a systemic device that
appears everywhere status appears, which is most of the app, most of the day. It's drawn
directly from the subject (build/CI status tags, `git status` porcelain output, log-line
prefixes), it solves the accessibility requirement (color is never the only signal — the tag
*is* text) as a side effect of the aesthetic rather than a bolt-on, and it's genuinely
executable at 375px width without needing a canvas/SVG diagram to get right.

Applied to the chat interface specifically: the user's messages stay as a normal rounded bubble
(this is still a messaging surface, per docs/07's mobile-messaging requirement) but agent
messages render as a left-bordered console line (`--signal` amber rule, monospace timestamp,
Plex Sans body) rather than a second bubble color — visually distinguishing "you" from "the
system" the same way a terminal distinguishes input from output, instead of the generic
two-bubble-colors messaging pattern. The confirmation card keeps its distinct-card requirement
(never mistakable for chat text) and adopts the bracket-tag language directly: its eyebrow reads
`[ CONFIRM ]` in Plex Mono rather than a plain "Confirm" label.

A pod/dev relationship diagram (branches/nodes, git-graph-like) remains a strong idea for the
Phase 4 dashboard specifically, once pods have enough real data to visualize — noted here so
Phase 4 builds toward it, but it is not this app's *one* signature choice; the bracket tag is,
because it's the thing Mehlab will actually see fifty times a day.

## Self-critique against the three named AI-slop patterns

- **Cream + terracotta + serif** — not used; no cream, no serif anywhere, no terracotta/clay.
- **Near-black + single acid accent as the only idea considered** — the base is graphite
  (`#0E1116`), not pure black, chosen after considering a light-default option (rejected because
  it fights the subject, not because dark is the reflexive default); the accent is a considered
  amber grounded in terminal history, not an arbitrary bright color, and it's one of six named
  tokens with real semantic roles, not the only idea on the palette. Light mode is a fully
  realized equal mode, not a fallback.
- **Broadsheet/newspaper hairlines + zero radius + dense columns, applied reflexively** — hairlines
  are used, but as row dividers in mobile card/list layouts for a stated reason (density in a
  daily-use dashboard), never as a multi-column text grid; radius is never zero.
- **Own prior mistake (generic modern-SaaS indigo + Inter + Space Grotesk)** — replaced with a
  palette and type pairing derived from the subject (terminal amber, IBM Plex's developer-tool
  heritage) rather than "what looks clean and modern."

No numbered decorative markers (01/02/03) anywhere — nothing in this app's content is a
generic sequence. No scroll-triggered animation; motion is limited to functional
micro-interactions (button press, card entry) and respects `prefers-reduced-motion`.
