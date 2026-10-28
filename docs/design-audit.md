# Product and design audit

## Reference-driven revision

The previous forest-green design made every panel equally important and explained the protocol more clearly than the product. The new references call for a large activity canvas, compact breakdowns, white surfaces, clear numbers and a recognizable voice.

- Palette: canvas `#faf9f7`, paper `#ffffff`, ink `#292624`, muted text `#71655d`, rose `#ad315a`, pale pink `#fbf0f4`.
- Excalidraw’s self-hosted Excalifont for headlines, wordmark and short notes; Manrope for controls and data; IBM Plex Mono for literal code and addresses. The font license and source attribution ship with the font.
- One main activity panel contains summary metrics and the chart. Client/location breakdowns follow, then visit details and page paths.
- Chart client filtering and hover/keyboard inspection use actual per-bucket counts. Provider labels come from request headers, independent of self-reported agent names. Header claims remain unverified.
- The landing page uses the same chart component with explicitly illustrative data. Its interactive example demonstrates both introductions and uninterrupted HTTP retrieval. No fake customer endorsements or performance claims.
- Matte black buttons and restrained stitched borders echo the requested tactile style. Pink is used for active states, the chart and occasional handwritten annotations.
- Existing workspace URLs, sign-in, questions, installation, exports, network controls and visit timelines remain available. Native introduction forms use the same neutral/pink palette.

## Compatibility and truth in the interface

Ordinary HTTP retrieval defaults to observation, including unfamiliar clients. Matched browser navigation can use the introduction. No customer selects a vendor or tells their agent how to check in. Intent stays unknown unless declared. The dashboard distinguishes content allowed without answers from questions shown without a response.

## Verification

Applied Frontend Design and Redesign Existing Projects, with the landing-page design-taste guidance. Review actual desktop and phone renders, then check keyboard interactions, overflow and WCAG A/AA contrast. Initial pale captions failed contrast checks and were darkened. The chart tests exercise client filtering and keyboard bucket values rather than merely checking that a graph exists.

Design quality remains a judgment. Passing these checks does not establish universal detection, universal question answering or zero churn.

## Motion

- Chart traces retarget from their current painted shape over 240ms. Equal polling refreshes do not restart motion. Geometry painting runs outside React; layout changes snap to their correct coordinate system.
- The probe and bounded tooltip glide between buckets. Counts update immediately, and leading-client rows stay in a consistent order/height. Tooltip exits fade without capturing input.
- Workspace/demo/tab entrances take 150–200ms; the visit drawer enters in 240ms and exits in 140ms. Interrupted opens can be dismissed without waiting.
- Buttons use short press feedback; ranking fills animate with transforms. No decorative loops were added.
- Keyboard interaction and reduced-motion preferences skip positional animation. Accessibility scans await finite presentation transitions before measuring contrast; separate tests exercise rapid retargeting, dismissal and reduced-motion behavior.

## Expanded agent canvas

The landing page now uses a 1512px canvas, a larger headline and original inline-vector agent characters. Ink trails, pink paper stickers and handwritten marginal notes fill the space around the product without placing decoration over controls. A connected visitor → Arrival → website illustration explains the flow, with explicit illustrative/identity-claim labels. Desktop connections become a vertical trail on phones. The data workspace and customer integration are unchanged.

Artwork is implemented as decorative SVG components, not raster screenshots or replacement interface icons. Reduced-motion settings disable sticker hover movement; the existing chart, native links and interactive visit demonstration remain usable. Phone layouts suppress long character captions and constrain decorative overflow to the canvas.
