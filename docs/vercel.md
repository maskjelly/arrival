# Deploy Arrival on Vercel

The frontend is static Vite output. API, manifest, optional check-in and demo routes run through `api/index.mjs`. Its handler is generated from checked TypeScript in `server/hosted.ts` during the build, avoiding a second TypeScript compilation in Vercel's function packager.

## Required configuration

| Production variable  | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `PUBLIC_URL`         | Canonical HTTPS collector origin, for example `https://arrival-iota.vercel.app` |
| `ADMIN_PASSWORD`     | Strong private owner password; configure as a sensitive secret                  |
| `TURSO_DATABASE_URL` | Durable database connection injected by Turso's Vercel integration              |
| `TURSO_AUTH_TOKEN`   | Private database credential injected by the integration                         |

Connect a free Turso database to the Arrival project using Vercel Marketplace. The account owner must accept the provider's terms. Keep function and database regions close; this installation uses `iad1`. Do not provision paid plans without approval.

Deploy from the repository using the checked-in `vercel.json`. The build compiles the frontend and API bundle, downloads the monthly DB-IP Lite City/ASN datasets and copies the server helpers into static output. Function tracing includes the read-only MMDB files. A failed database download fails the build, preserving the previous deployment. Updates happen on redeploy; the hosted dashboard disables its local database download control.

Vercel's deployment login wall must permit public collector traffic. Arrival's own password authentication protects owner APIs and exports. A Vercel SSO redirect in front of `/tracker.js` or `/api/collect/*` prevents collection. Preview protection is a separate deployment setting; never distribute a preview bypass secret to visitors.

## Persistence and trust

`server/database.ts` uses local Node SQLite for development and the fetch-only `@libsql/client/web` transport when configured for Turso. All storage calls are awaited. Hosted startup refuses missing durable database or owner credentials; it never silently creates an ephemeral `/tmp` database. Schema initialization is idempotent, concurrent server reports reuse their external session key, event IDs deduplicate requests, and network history uses compare-and-swap updates.

The hosted entrypoint trusts one Vercel proxy hop. Vercel overwrites forwarding headers at its edge; do not reuse this entrypoint behind an arbitrary proxy. Host adapters retain integration-reported provenance. IP data identifies the visible exit network, not the agent's actual host behind a proxy.

## Customer installation, including Whiteye

Use `/start` to create the customer workspace and password. The generated setup is the source of truth: install the published Next.js package, set the collector URL, generated public site ID and private integration key, export the SDK middleware and include its browser component. See [the package guide](../packages/next/README.md).

Whiteye uses that exact installation. Its private dashboard is `/app/whiteye`. It has no custom declaration endpoint or hand-copied server helper. Old operator demo records remain under the legacy workspace, separate from the new customer’s records.

## Verify the deployment

1. Fetch `/api/health`, `/tracker.js` and `/.well-known/arrival.json` without authentication. Expect JSON, JavaScript and JSON respectively, with no Vercel login redirect.
2. Confirm `/api/admin/overview` returns 401 without an owner session and `/api/auth/local` cannot bootstrap publicly.
3. Sign into `/app`, confirm both local IP datasets are available and inspect the saved site origin/questions.
4. Fetch `https://whiteye.in/`, `/blog` and `/resume` with one cookie jar and a recognizable test User-Agent. The server visit should show those paths with integration-reported provenance.
5. In a browser, visit the website, answer the automatic introduction, navigate and check that browser activity appears on the same server visit.
6. Open a second owner session and confirm the same visits persist. Do not equate a health response or successful build with collected website traffic.

Customer workspaces start with the standard question set and can edit it independently. Previous local demo records remain in `.data/arrival.sqlite`; they are not silently presented as new whiteye traffic.

## Phone-agent test

Ask the agent to open the live website directly, read two projects and the résumé, and recommend a project for a Rust/AI systems role. Include a fresh test query in the starting URL to reduce upstream fetch-cache reuse. The request log intentionally strips that query; identify the run by time and paths. Cached search snippets alone may not contact the website.

For intent answers, let it follow the automatic introduction at the page it requested. The integration also exposes `https://whiteye.in/.well-known/arrival.json` for discovery and provides a GET answer path for read-only HTTP tools. Read-only tools can use the GET answer path; willingness to answer depends on the agent. Never request private task context. The standard Next.js SDK links browser activity to its host session. Tools that retain neither cookies nor the continuation parameter may create separate visits on later requests.

Source references: [Vercel filesystem limits](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [request-header trust](https://vercel.com/docs/headers/request-headers), [Turso on Vercel](https://vercel.com/marketplace/tursocloud/database), and [Next.js middleware background work](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware).

## Fetch-only compatibility

With Next.js SDK 0.2.3, ordinary HTTP fetches (including unfamiliar tools and known Claude/ChatGPT/Perplexity fetch user agents) receive the actual page, without an introduction. A request is recorded with intent unknown. Browser automation still uses the introduction. To retest Claude chat, use a fresh conversation and a fresh URL query to reduce reuse of its earlier fetched form; Arrival cannot purge a provider cache. SDK/HTTP tests establish response behavior, not willingness or capabilities of every chatbot product.
