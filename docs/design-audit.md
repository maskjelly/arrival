# Dashboard design audit

The previous interface was checked in a real browser before editing. The redesign targets the daily workflow: see traffic, inspect a visit, understand its declared objective, and connect another data source.

## Findings and changes

| Before                                                                                                   | After                                                                                                   | Why                                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Pink cloth textures, double borders, stitched buttons and similarly tinted text throughout the workspace | Neutral white/slate surfaces, ink text and one cobalt accent                                            | Data and actions need to carry the hierarchy. Decoration competed with both.           |
| A full-width navigation strip plus a second workspace toolbar                                            | Persistent workspace navigation and a compact context header; a dismissible navigation drawer on phones | More room for analytics, predictable locations for setup and configuration.            |
| Large panels and padding pushed recent visits down the page                                              | Compact metrics, a shorter plot, tighter rows and restrained panel spacing                              | Make the current activity easier to scan before scrolling.                             |
| Repeated marketing copy and visible server setup before the first install                                | Website → platform → snippet → verification, with server collection in an explicit disclosure           | Keep the default path short while retaining advanced capabilities.                     |
| Pale metadata and several 9–11px labels                                                                  | Darker secondary text and clearer primary type, with tabular numerals                                   | Increase readability without making every label equally prominent.                     |
| In-memory navigation lost the selected view on refresh                                                   | Link-based views with URL state and browser Back support                                                | A workspace page can be bookmarked, reopened or shared.                                |
| Platform tabs lacked arrow-key behavior; code overflow was awkward to reach by keyboard                  | Roving keyboard tabs, focusable code regions, skip navigation and Escape-to-close mobile navigation     | Support keyboard operation alongside pointer use.                                      |
| A large fabric stylesheet overrode an older stylesheet and its breakpoints                               | One dashboard stylesheet plus a separate landing stylesheet                                             | Remove the conflicting design layers that made changes hard to predict.                |
| Pink landing, demo and check-in styling                                                                  | Shared neutral/cobalt visual language across all surfaces                                               | Make the product feel coherent while keeping the external check-in small and optional. |

## Design system

- **Type:** self-hosted IBM Plex Sans, with IBM Plex Mono for code. No external font request.
- **Colour:** ink `#202939`, canvas `#f5f6f8`, white panels, borders `#e5e9f0`, cobalt `#355bd8`. Green indicates an observed/synced state, not verified identity.
- **Layout:** constrained content area, stable navigation, small consistent gaps, and a separate visit drawer.
- **Interaction:** immediate view changes, visible focus, reduced-motion support, explicit advanced disclosures. No decorative motion in analytics.
- **Data:** existing API records only. No seeded graphs, invented percentages, operator verification badges or synthetic growth claims.

## Skills reviewed

- [Redesign Existing Projects](https://skills.sh/leonxlnx/taste-skill/redesign-existing-projects): audit the existing implementation and improve it within the current React/native CSS stack.
- [Vercel Web Interface Guidelines](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines): contrast, focus, semantic controls, navigation state and content overflow.
- [Emil Design Engineering](https://skills.sh/emilkowalski/skills/emil-design-eng): crisp interactions, restrained motion, accessible focus behavior and component consistency.

The skills were already available in the local skills catalog; no additional global skill installation was needed. The public directory and linked guidance were checked during this task. The landing-focused Design Taste skill explicitly excludes dashboards, so its marketing defaults were not used as dashboard requirements.

## Validation

Playwright exercises the production build, using a separate test database. It covers the dashboard, exports, optional check-in, custom questions, real cross-origin installation, mobile layouts, keyboard platform tabs, URL/Back behavior and drawer dismissal. Axe checks the workspace views and visit detail sections against WCAG A/AA rules, including text contrast.

Screenshots are inspected at desktop and phone widths, with both real recorded visits and an empty test database. Automated accessibility checks do not replace screen-reader testing, real-device testing, or the user's assessment of the visual design.

## Network intelligence extension

The Origins view uses the same workspace hierarchy: compact coverage metrics, country/operator filters, a searchable evidence list, then source attribution. The visit drawer opens directly to Network when selected from Origins. IPs use monospace; capture source, approximate location, ASN ownership and hosting inference stay separate. A source note explains proxy limitations beside the data.

Desktop and phone screenshots were inspected against the live database, including populated country/operator lists. That pass caught low-contrast country codes; their text was darkened and enlarged. Browser coverage now includes populated lists, long IPv6 addresses, network details, unknown/private addresses and dataset setup. Test-only UI fixtures never enter the workspace database.
