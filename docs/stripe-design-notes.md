# Dashboard design notes: Stripe-inspired light workspace

Scope: `src/dashboard.css` only. Marketing (`landing.css`) and onboarding keep their
existing visual language. All dashboard tokens are scoped to `.app-shell`,
`.login-screen` and `.loading`, so no landing/onboarding token is overwritten.

## References

- Stripe Dashboard documentation, primary navigation, shortcuts and product groups:
  <https://docs.stripe.com/dashboard>
- Stripe Dashboard search / compact filtering conventions:
  <https://docs.stripe.com/dashboard/search>
- Stripe mobile Dashboard, responsive navigation and summary surfaces:
  <https://docs.stripe.com/dashboard/mobile>
- Stripe Payments product page, including current Dashboard report and payments-table
  imagery used for row density, tab treatment and status badges:
  <https://stripe.com/payments>
- Stripe Billing product page, reference for metric cards and the single-accent
  hierarchy: <https://stripe.com/billing>

Observed patterns carried over from those first-party surfaces:

- Light sidebar rail separated from a white work surface by one hairline; grouped
  navigation with quiet, wide-tracked group labels.
- Navy-ink headings over slate secondary text; body copy never competes with numbers.
- Key metric cards as flat outlined rectangles, no drop shadows, values in tabular
  figures, supporting detail in muted 11-12px text.
- Tables with a tinted uppercase header row, hairline row dividers only, generous
  vertical rhythm and no vertical rules or zebra stripes.
- A single indigo accent for the active nav item, links, selected controls, chart
  series and primary actions. Green/amber/red appear only as status semantics.
- Dark navy code snippets on an otherwise light page (a deliberate, semantic dark
  surface rather than a dark section).

## Tokens

| Token              | Value     | Use                                                        |
| ------------------ | --------- | ---------------------------------------------------------- |
| `--canvas`         | `#f6f9fc` | login/boot background, sunken chart surfaces               |
| `--surface`        | `#ffffff` | work surface, rail cards, panels                           |
| `--surface-subtle` | `#fafbfc` | table heads, footnotes, code-adjacent metadata             |
| `--surface-sunken` | `#f6f9fc` | inputs-in-groups, icon tiles, segmented controls           |
| `--ink`            | `#0a2540` | headings, values, primary text                             |
| `--ink-secondary`  | `#425466` | table body, descriptions, secondary labels                 |
| `--muted`          | `#697386` | meta text, column heads, helper copy (4.9:1)               |
| `--faint`          | `#5f7085` | small labels that still need AA contrast (5.1:1)           |
| `--line`           | `#e3e8ee` | separators, card outlines                                  |
| `--line-soft`      | `#eef2f6` | in-panel rows and dividers                                 |
| `--line-strong`    | `#d6dee8` | input/button borders                                       |
| `--accent`         | `#4f46e5` | links, primary buttons, chart, active nav (6.3:1 on white) |
| `--accent-soft`    | `#f1f0ff` | active nav fill, selected list rows, callouts              |
| `--success`        | `#0b7a45` | admitted status, live indicator                            |
| `--warning`        | `#9a5a00` | awaiting status, identity caveats                          |
| `--danger`         | `#b42318` | revoked/expired, destructive actions                       |

Indigo `#635bff` is Stripe's signature blurple, but white text on it measures below
4.5:1. The action fill uses `#4f46e5` instead; `#635bff` is kept as `--accent-bright`
for non-text decoration if needed.

Shape: 6px for controls and row highlights, 8px for panels and KPI cards, 10px for
the sign-in card. Shadows are limited to 1px button definition and the drawer/toast
elevation; panels are intentionally flat.

Type: existing Manrope Variable only. Display 27px/600 with -0.7px tracking; section
headings 14px/600; body and table 12-13px; meta 10.5-11px; IBM Plex Mono for IDs,
paths and code. All numeric surfaces use `tabular-nums`.

## Layout

- 248px sticky rail; white body with a 1440px content cap and 32px gutters (24px at
  tablet, 14px at phone).
- 56px sticky topbar with a translucent white backdrop and a single bottom hairline.
- Page heading: optional quiet context line, title + live chip, one-line description,
  actions right-aligned; actions wrap below the title at 700px.
- KPI row: 4 / 2 / 2 columns. Overview triptych: 3 / 2 / 1. Recent list collapses to
  a three-row grid on phones; the visit table becomes cards below 700px.
- Drawer becomes full width below 700px; mobile rail is 272px with a blurred navy
  scrim and 38px targets.

## Interaction and accessibility

- Focus: 2px indigo outline with 2px offset; the table scroll region uses an inset
  ring. The `main` skip target suppresses the ring after nav focus.
- Hover changes background/border only; press moves 0.5px. No hover scale effects.
- `prefers-reduced-motion: reduce` disables the live pulse and all control/rail
  transitions; the loading spinner is retained because it communicates progress.
- Verified with axe-core (`wcag2a`, `wcag2aa`) at 1440px on Overview, Visits,
  Questions, Connect, Origins and Visibility; also mobile Overview, mobile nav,
  visit drawer and sign-in: zero violations.
- No horizontal overflow at 320, 390, 700, 900, 1100 and 1440px.

## Integration notes for the parent

- `visibility.css` consumes `--line`, `--muted`, `--ink`, `--accent` and
  `--accent-soft`; these now resolve to the light Stripe palette inside
  `.app-shell`, so the Visibility report inherits the new shell automatically.
- New dashboard surfaces should reuse `.panel`, `.panel-heading`, `.button`,
  `.text-button`, `.status`, and the tokens above rather than hardcoding colours.
  Avoid fixed warm greys; they will read as a different product next to these.
- Shared table convention: `.visit-table` header is 11px uppercase on
  `--surface-subtle`; rows are 12px with `--line-soft` dividers. The Visibility
  table keeps its own local rules but matches the same rhythm.
- The chart SVG in `ActivityChart.tsx` still carries a rose palette inline. The
  stylesheet recolours its presentation attributes (`stroke`, `stop-color`, `fill`)
  to indigo without changing the component; if the chart is refactored, prefer
  `currentColor`/CSS variables over new hardcoded hex values.
- The entry ring's inline conic gradient still uses `var(--accent)` plus a warm
  track (`#f1e9ee`). The track is neutral enough to sit quietly, but a future
  component edit should use `var(--line-soft)` plus a percentage custom property.
- Do not re-add `:root { --accent: ... }` overrides in this file: the scoped token
  block is what keeps landing/onboarding untouched.
