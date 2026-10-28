# Build status

## Implemented

- Natural page entry: questions for recognized interactive agents, forms/GET submissions, original destination, site-bound one-hour passes.
- Cooperative browser automation handoff to the same introduction; no repeated browser questionnaire after completion.
- Customer workspace creation/sign-in, site-scoped ingestion keys, scoped records/reports/exports.
- Reusable Next.js package and one standard setup flow; browser-only HTML/Wix/Shopify snippets remain available.
- Question editing and per-visit snapshots; declared objectives separated from observed/integration-reported behavior.
- Default HTTP retrieval policy: allow content, retain request/network analytics, mark undeclared intent unknown. Dashboard distinguishes unanswered introductions from submitted answers.
- Entry funnel, visits, country/state/network breakdowns and offline IP lookup.
- Vercel deployment with durable Turso storage; local SQLite development.
- Product website, customer onboarding, dashboard and responsive/accessibility checks.

## Not implemented

- Universal or cryptographic agent identity; guaranteed detection of disguised computer-use clients.
- Guaranteed zero churn or inferred private prompts.
- Teams, password reset, verified domain ownership, billing and automated retention/deletion.
- Native Wix/Shopify apps, complete CDN connectors or API-handler gating from a browser snippet.
- Distributed rate limits, durable ingestion queues, complete pagination/exports and recovery automation.

Availability wins during collector outages. Known fetch-only clients and search indexers continue without questions. The question layer enforces the healthy matched-agent path; it is not access authorization for private website content.
