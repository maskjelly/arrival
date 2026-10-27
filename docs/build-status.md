# Arrival: stack and build status

This describes the implemented local MVP, not a production SaaS. The same feature inventory appears on the landing page and in the workspace's **Built & next** view, from `src/project.ts`.

## Stack

| Part         | Current implementation                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Frontend     | React 19.3, TypeScript 7, Vite 8.3                                                    |
| Interface    | Native CSS, self-hosted Outfit, IBM Plex Mono for code, Phosphor icons                |
| Server       | Node.js; verified locally on Node 26. Express 5.3 with TypeScript executed by tsx     |
| Storage      | SQLite through Node's built-in `node:sqlite`, WAL, prepared statements                |
| Validation   | Zod 4.6                                                                               |
| Owner access | Local-only owner bootstrap or a configured owner password; hashed session credentials |
| Testing      | node:test for API/integration checks, Playwright for actual browser journeys          |

There is no external model call, external authentication provider, Redis, distributed queue, or cloud deployment in the current build.

## Implemented

- **Public landing page at `/`:** original pink fabric styling, interactive example, product explanation, build status, stack, and working navigation.
- **Workspace at `/app`:** overview, visit explorer, editable questions, collection setup, and Built & next.
- **Questionnaires:** required/optional short and long answers, single/multiple choice, configurable order, and historical schema snapshots.
- **Protected demo at `/lab`:** visible browser form or JSON challenge, credential rotation, one-hour read/search/download grants, expiry, and revocation.
- **Visit data:** declared objective and custom answers, request context, basic browser signals, referring paths, event history, searches, downloads, and a local shortlist action.
- **Browser embed:** page views, bounded context, scroll milestones, visibility, annotated clicks, and a dismissible questionnaire for suspected automation or every visitor.
- **Server collection:** private ingestion key, key rotation, event deduplication, and a best-effort Express reporting adapter.
- **Inspection/export:** visit details, evidence provenance, event payloads, JSON visit export, and CSV summaries.
- **Persistence:** visits and configuration survive restarts in local SQLite.
- **Validation:** required-answer checks, permissions, token expiry/revocation, owner/origin checks, credential-free exports, and actual browser/HTTP journeys.

## Still to build

### Next: prove identity and protect real host sites

1. **Verified agent operators.** Add a separate signed-request verification module, such as Web Bot Auth. A name in a header or form is not verification.
2. **An external admission adapter.** Enforce the check-in grant at another site's server/CDN boundary. The current browser embed cannot secure host content.
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

The landing page takes its product-led hierarchy and concrete demonstrations as a reference from [ByDefault](https://www.bydefault.so/). The layout, copy, examples, and pink woven visual system are original to Arrival. Cloth effects use CSS weaving patterns, matte surfaces, dashed inset stitching, and a local SVG grain asset; they do not require an image service.
