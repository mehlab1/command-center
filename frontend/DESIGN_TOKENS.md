# Design Tokens — FinovaSolutions Command Center

Read `docs/07-frontend-design-system.md` before changing any of this. This is a daily-use
ops tool for one person on a phone, not a marketing surface — tokens optimize for scan-speed
and legible status, not first-impression wow.

## Self-critique against the three AI-slop patterns (done before implementing)

- **Cream + terracotta + serif** — not used. Base neutral is a cool slate/ink pair, no warm
  cream, no serif anywhere, accent is a saturated indigo rather than clay/terracotta.
- **Near-black + single acid accent as the only idea considered** — rejected as the *only*
  option; landed on a light-first slate/ink pair with one accent (see below), chosen because
  a dense status dashboard needs a light surface for long daily reading sessions, with a true
  dark variant (not just "black + neon") for evening use.
- **Broadsheet/newspaper (hairline rules, zero radius, dense columns)** — not used. Uses a
  soft radius scale and card-based grouping, not ruled columns, because the content is
  relational (people/pods/tasks) rather than columnar text.

## Color

Two named neutrals + one accent + semantic status colors. Defined as CSS custom properties in
`globals.css` under `@theme`, light values by default, dark overrides under
`prefers-color-scheme: dark`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-ink` | `#12172B` | `#F3F4F8` | primary text |
| `--color-ink-muted` | `#5B6178` | `#A6ABC2` | secondary text |
| `--color-surface` | `#F7F8FB` | `#0E1120` | app background |
| `--color-surface-raised` | `#FFFFFF` | `#171B30` | cards, sheets |
| `--color-border` | `#E2E4EE` | `#262B45` | hairlines, input borders |
| `--color-accent` | `#4C4FE0` | `#7B7EFF` | primary actions, links, focus ring |
| `--color-accent-contrast` | `#FFFFFF` | `#0E1120` | text/icons on accent fill |

Semantic status (identical light/dark, tuned for 4.5:1+ contrast on `--color-surface-raised`):

| Token | Value | Meaning |
|---|---|---|
| `--status-todo` | `#6B7094` | To Do |
| `--status-in-progress` | `#B7791F` | In Progress |
| `--status-done` | `#1E8E5A` | Done |
| `--status-blocked` | `#D0342C` | Blocked |
| `--status-on-time` | `#1E8E5A` | on-time (ratings/history) |
| `--status-overdue` | `#D0342C` | overdue |

**Color is never the only signal** — every status token pairs with a fixed icon + label
(see `docs/07-frontend-design-system.md` accessibility floor). Enforced at the component
level (`StatusBadge` always renders icon + text, never a bare color dot).

## Type

Two typefaces, both self-hosted via `next/font`, no system-font fallback as the primary look:
- **Space Grotesk** — headings, nav labels, numeric/data emphasis (deadlines, counts, ratings).
  Has enough geometric character to read as considered without becoming a display face.
- **Inter** — body copy, chat bubbles, form fields, table/list content. Optimized for small
  sizes at high density, which is most of this app's surface area.

Scale (rem, mobile baseline — same scale reused at desktop, layout width changes, type does
not need a second scale):

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 0.75rem | timestamps, meta |
| `--text-sm` | 0.875rem | secondary body, form labels |
| `--text-base` | 1rem | primary body, chat text |
| `--text-lg` | 1.125rem | card titles |
| `--text-xl` | 1.375rem | section headers |
| `--text-2xl` | 1.75rem | screen titles |

## Spacing

4px base unit: `--space-1` (4px) through `--space-12` (48px), i.e. `1=4px, 2=8px, 3=12px,
4=16px, 6=24px, 8=32px, 12=48px`. Matches Tailwind's default numeric spacing scale directly —
no custom spacing config needed, just documented here as the intentional scale rather than
default-by-accident.

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | inputs, small buttons, badges |
| `--radius-md` | 10px | cards |
| `--radius-lg` | 16px | sheets/modals, confirm-before-commit cards |

Never `0` (would read as the broadsheet pattern) and never fully pill-shaped by default
(would read as generic AI-slop softness) — 6–16px throughout.

## Signature element (spend the one "bold" choice here)

The one memorable visual idea, reserved for the Dashboard/Pods views built in later phases:
a **pod cluster diagram** — each pod renders as its lead at the center with member avatars
arranged around it, connected by thin accent-colored lines, rather than a plain list/table.
This is the single place motion/emphasis is spent; everything else in the UI (forms, chat,
task lists) stays quiet and disciplined around it. Not built in Phase 1 (no dashboard yet) —
documented now so later phases implement toward it instead of defaulting to a plain list.
