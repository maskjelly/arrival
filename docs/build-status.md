# Arrival: stack and build status

This describes the implemented local MVP, not a production SaaS. The same feature inventory appears on the landing page and in the workspace's **Built & next** view, from `src/project.ts`.

## Stack

| Part         | Current implementation                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Frontend     | React 19.3, TypeScript 7, Vite 8.3                                                    |
| Interface    | Native CSS, self-hosted IBM Plex Sans, IBM Plex Mono for code, Phosphor icons         |
| Server       | Node.js; verified locally on Node 26. Express 5.3 with TypeScript executed by tsx     |
| Storage      | SQLite through Node's built-in `node:sqlite`, WAL, prepared statements                |
| Validation   | Zod 4.6                                                                               |
| Owner access | Local-only owner bootstrap or a configured owner password; hashed session credentials |
| Testing      | node:test for API/integration checks, Playwright for actual browser journeys          |

There is no external model call, external authentication provider, Redis, distributed queue, or cloud deployment in the current build.

## Implemented

- **Public landing page at `/`:** neutral surfaces, cobalt accents and readable typography, interactive example, product explanation, build status, stack, and working navigation.
- **Workspace at `/app`:** overview, visit explorer, editable questions, collection setup, and Built & next.
- **Questionnaires:** required/optional short and long answers, single/multiple choice, configurable order, and historical schema snapshots.
- **Open demo at `/lab`:** immediate access, optional browser/HTTP check-in and actual request/action recording. Mandatory admission remains an advanced, off-by-default demo option.
- **Visit data:** declared objective and custom answers, request context, basic browser signals, referring paths, event history, searches, downloads, and a local shortlist action.
- **Browser embed:** one copy-paste install, route tracking, per-tab session continuity, bounded context, annotated actions, and a collapsed optional prompt that never takes focus.
- **Server collection:** private key, rotation, deduplication, an Express helper without session middleware, and a dependency-free Web Request helper for Next.js and other runtimes.
- **Install guides:** Any website, Wix, Shopify and Next.js tabs, copyable snippets and verification from actual collected origin data.
- **HTTP agents:** discoverable public manifests, question snapshots and a voluntary reporting endpoint with agent-reported provenance.
- **Inspection/export:** visit details, evidence provenance, event payloads, JSON visit export, and CSV summaries.
- **Persistence:** visits and configuration survive restarts in local SQLite.
- **Validation:** required-answer checks, permissions, token expiry/revocation, owner/origin checks, credential-free exports, and actual browser/HTTP journeys.

## Still to build

### Next: widen coverage and improve evidence

1. **Verified agent operators.** Add a separate signed-request verification module, such as Web Bot Auth. A name in a header or form is not verification.
2. **Native platform apps and CDN log connectors.** Current Wix/Shopify support is a custom-code snippet. Automatic HTTP-only request logging on hosted platforms requires access to request logs or a separate integration.
3. **Measured detection quality.** Build labeled evaluations of HTTP, browser automation, computer-use, accessibility, privacy settings, and human/agent handoff. Add trusted WAF signals where available.

### Before operating as a SaaS

4. **Accounts, teams, multiple sites, and tenant isolation.** Current storage and APIs assume one owner/site.
5. **Durable delivery.** Queues, retry policies, idempotent processing, and outage recovery. The current adapter is best-effort.
6. **Retention and deletion.** Scheduled policies, owner controls, and audit records. There is no automatic retention job.
7. **Larger-scale queries.** Pagination, complete exports, and performance work. Current queries show the latest 300 visits and at most 1,500 events per visit.
8. **Production operations.** Managed HTTPS deployment, monitoring, backups, recovery testing, and deployment procedures. Billing is a later product decision.

## Data boundaries

- Agent identity is unverified in this MVP.
- Task answers are declarations; observed activity is stored separately.
- The collector does not recover private prompts or inspect unrelated browser tabs.
- IP/network metadata can describe a proxy or browser host, not the end user.
- The marketing example is explicitly illustrative and never reads private workspace data.

## Design direction

The dashboard uses a white/slate/cobalt palette, self-hosted IBM Plex Sans and Mono, compact data panels and one persistent workspace navigation. The landing page, public demo and optional check-in use the same visual language. See [the design audit](design-audit.md) for findings, tradeoffs and validation.
