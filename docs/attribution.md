# Visitor attribution

Arrival keeps five independent layers alongside the declared task:

- **Provider and client:** match bounded client tokens in request user agents. An answer claiming a tool name does not replace the request evidence. Conflicting tokens stay ambiguous. An IP-only provider match never establishes a specific client or role.
- **Identity confidence:** compare the arrival IP and client-specific feed against current official IPv4/IPv6 prefixes. Results distinguish `network corroborated`, `header claim only`, `network match only`, `conflicting claims` and `unidentified`. There is no numeric probability and no cryptographic verification claim. Authenticated integrations still report their own source IP evidence.
- **Crawler role:** published search indexing, model-training, user-requested retrieval or ad-review role, with provider documentation. This is the client’s published function, not proof of what this particular visit intended or how its data was used. Generic clients retain broad automation/script labels.
- **Referral:** a supplied HTTP referring URL, classified independently of provider. Keep only recognized search-result query parameters (`q`, Yahoo `p`, Baidu `wd`, Yandex `text`) with a 300-character limit. Drop other query parameters, credentials and fragments. A missing referrer cannot distinguish a direct visit from a stripped/private referral. No search query or private prompt is guessed.
- **Observed journey:** first 16 recorded requests, page views and clicks in event order, with source provenance, total recorded steps and latest path. Only activity tied to that visit's existing authenticated/session identifiers is grouped. No IP-only stitching. The full recorded timeline retains the existing 1,500-event read limit; exports retain the existing 300-visit limit.

`Task unknown` means no objective was declared. It does not erase the other layers. Existing sessions are enriched on read, without changing answers, historical request data or question behavior. Search terms stripped before this release cannot be reconstructed.

## Modules and updates

- `server/attribution.ts`: client registry, roles, referral parsing and evidence composition.
- `server/provider-ranges.ts`: bounded feed validation, IPv4/IPv6 matching, refresh and freshness.
- `server/provider-feeds.json`: fixed official feed URLs, never visitor-supplied URLs.
- `server/data/provider-ranges.json`: bundled fallback snapshot, included in the hosted bundle.
- `scripts/update-provider-ranges.mjs`: update the bundled snapshot before a release with `node scripts/update-provider-ranges.mjs`.
- `src/VisitContext.tsx`: dashboard evidence, summary breakdowns and recorded journey.

Production owner overview/detail/export reads refresh feeds at most once per six hours per process, coalescing concurrent refreshes and bounding each fetch to 3.5 seconds. Failed feeds retain their last good copy. Snapshots older than seven days cannot corroborate identity. The visitor ingestion/content path never performs a provider lookup request and does not depend on provider availability. The application entrypoints enable refresh; isolated test apps default to bundled data.

Matches compare the arrival IP with **current** lists and expose the list check timestamp. They do not certify historical IP ownership. A changed or missing range is not proof of impersonation. Demo sessions never receive network corroboration. Hosting ASN names such as AWS or Azure are not agent-provider identity.

Official sources: [OpenAI](https://developers.openai.com/api/docs/bots), [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Anthropic ranges](https://claude.com/crawling/bots.json), [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers), [Google](https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot), [Bing](https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26). Redirected feed URLs are pinned to their current official destination; unexpected redirects fail closed for enrichment, while the website continues working.
