# Dashboard design notes: floating canvas, top navigation

The authenticated workspace is a light, spacious dashboard: a soft canvas with a
rounded floating work surface, a centered top navigation, pill controls and
large-radius cards. Marketing (`landing.css`) and onboarding keep their existing
visual language.

## References

- Supplied product reference: soft grey-lilac canvas, rounded dashboard frame,
  logo + centered nav + search/avatar row, large white hero card with a chart,
  a card-less recent-projects list, and three distinct cards beneath.
- Stripe Dashboard for the metric strip, tabular numbers, compact table rhythm,
  grouped navigation and single-accent discipline:
  <https://docs.stripe.com/dashboard>
- Stripe Billing for the key-metric card and the quiet semantic use of status
  colours: <https://stripe.com/billing>
- Stripe mobile Dashboard for the responsive rail and summary surfaces:
  <https://docs.stripe.com/dashboard/mobile>

## Tokens

| Token             | Value                             | Use                                              |
| ----------------- | --------------------------------- | ------------------------------------------------ |
| canvas            | `#d9dce5` + lilac/sky radial wash | outer page behind the floating work surface      |
| `--surface`       | `#ffffff`                         | cards, side-list items, table rows               |
| frame             | `#f5f6f9`                         | the floating dashboard surface                   |
| `--ink`           | `#191b25`                         | headings, values, primary text                   |
| `--ink-secondary` | `#425466`                         | table body and secondary copy                    |
| `--muted`         | `#5f6878`                         | labels, meta, helper copy                        |
| `--faint`         | `#626a7a`                         | small metadata; still AA on white/canvas         |
| `--line`          | `#e3e8ee`                         | hairlines and row dividers                       |
| `--line-soft`     | `#eef2f6`                         | in-card dividers                                 |
| `--accent`        | `#4f46e5`                         | active nav, links, primary actions, chart series |
| `--accent-soft`   | `#f1f0ff`                         | active states and soft icon tiles                |
| `--success`       | `#0b7a45`                         | live/admitted status only                        |
| `--warning`       | `#9a5a00`                         | caveats and awaiting status                      |
| `--danger`        | `#b42318`                         | revoked/expired status                           |

Shape: 20–22px cards, 14–16px inner list cards, 999px pills, 10–12px icon
tiles. Shadows are very soft and used to lift white cards off the canvas, not to
outline nested boxes. Keep one indigo accent for interaction and data; use muted
slate tints for the remaining traffic categories.

Type: Manrope Variable. Display 35px/650 with -1.5px tracking; page description
13px; card titles 16–18px/650; body 12–13px; meta 9.5–11px; IBM Plex Mono for
paths and IDs. Numeric surfaces use `tabular-nums`.

## Layout

- 18px outer canvas; 1480px max-width floating frame; 26px radius; no page-wide
  card borders. On phones the frame is edge-to-edge with no radius.
- 72px top navigation: logo left, centered page links with a 2px active underline,
  search pill / live status / refresh / avatar / sign-out right. There is no
  desktop sidebar. The old rail survives only as a mobile drawer (300px, 22px
  radius, blurred scrim).
- Page heading: 35px title, subtitle, period select pill and export pill.
- Hero grid: large report card left, card-less recent/side list right. The large
  card contains a flush four-column metric strip + chart (Overview) or metric
  strip + visitor mix (Visibility). The side list is made of individual white
  list cards on the canvas, not another enclosing panel.
- Bottom row: three cards — pages, sources, discovery coverage. On tablet they
  collapse to two columns; on phones one column.
- The detailed activity report keeps tabs and a 15-row table in one card. Tabs
  are underline tabs; rows are hairline-separated and hover only.
- Secondary pages (Visits, Origins, Questions, Connect, Built & next) inherit the
  same frame, card, pill and table language.

## Interaction and accessibility

- Focus: 2px indigo outline with 2px offset. Pills and cards use background and
  border changes, not scale effects. Press feedback is a 0.5px move.
- All muted text is at least 4.5:1 on white and on the frame; `#5f6878` is the
  floor for small copy.
- `prefers-reduced-motion: reduce` disables the live pulse and rail transitions.
- Verified with axe-core (`wcag2a`, `wcag2aa`, `wcag21aa`) across all workspace
  views at 1440px and on mobile, with zero violations.
- No horizontal overflow at 320, 390, 700, 900, 1100 or 1440px.

## Implementation notes

- `src/refined.css` is imported last and owns the floating frame, top nav, pill
  controls and the final card treatments. `src/dashboard.css` still provides the
  scoped tokens and base components. Do not reintroduce a desktop sidebar or
  nested card borders here.
- `RangePicker` is a pill-shaped select, not a segmented button group. The
  accessible name remains “Date range”.
- The mobile `.sidebar` is the only navigation drawer; desktop links come from
  `.topnav-links`. Tests use both paths.
- Visibility table pages contain 15 visits; offset selects the next page. The
  report still exports up to the 5,000-visit ceiling.
- The chart SVG keeps its inline geometry; dashboard/refined CSS recolours the
  strokes to indigo. Prefer token-based styling for new chart surfaces.
