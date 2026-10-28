# Development and operation

A working local MVP for understanding agent visits: ask why a visitor arrived, capture browser/request context, and connect those answers to an activity timeline.

## Run

Use Node.js 24 or newer. The local implementation was initially verified with Node 26.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:3000** for the landing page or **http://127.0.0.1:3000/app** for the workspace. The dashboard automatically creates an owner session when accessed directly from localhost. It starts with an empty database; **Run a demo agent** makes real HTTP requests through the instrumented demo and labels the resulting visit as a controlled demo.

The app stores records in `.data/arrival.sqlite`. Restarting preserves visits, questions and configuration. No external account or model key is needed.

## What works

- Owner dashboard with real counts, time series, filters and visit inspection.
- Custom short/long-answer, single-choice and multiple-choice questions, with required fields and saved schema versions.
- Open demo at `/lab`: immediate access, optional nonmodal browser questions, structured JSON for HTTP clients, search, downloads and a local shortlist action. Mandatory demo admission is an explicit advanced setting.
- Embeddable browser tracker: page views, selected browser context, scroll milestones, visibility, explicitly annotated clicks and optional questions.
- Authenticated ingestion and Express/Web Request reporting helpers for clients that do not execute JavaScript.
- Platform-specific snippet setup and real origin-based installation verification.
- JSON export with answers, question snapshots, evidence and events; CSV summary export.
- Origins view and per-visit Network tab: exit IP, approximate location, ASN organization, inferred hosting network, capture provenance and bounded address history. Free databases install from the workspace or `npm run geo:update`.

## Try it

1. Click **Run a demo agent**. Inspect its answers and activity.
2. Open **Questions**, add your own question, and save it.
3. Open `/lab`. Browse immediately; open **Share your task (optional)** to answer questions.
4. In **Connect a website**, save your website's exact origin and copy the tracking script. Choose suspected automation, every visitor, or tracking only.
5. For HTTP-only request evidence, generate a server ingestion key and install the Express or Web Request helper. See [platform installation](integrations.md).

Browser-only prompts are dismissible. The full Next.js integration presents the question step to recognized interactive agents and browser-reported automation. Its clearance resumes the original URL; outages still leave the website available. Create customer workspaces at `/start`; `/app/<workspace>` uses that customer password. Detection is heuristic. Blocking is not part of the installation. Existing databases preserve their saved advanced demo policy; turn it off in Questions to use observation.

## HTTP check-in

Read `/api/agent/manifest/site_local` for the optional reporting protocol and public questions. `/.well-known/arrival.json` is a single-site alias. The HTML embed includes a discovery link for non-JavaScript agents. The manifest is an Arrival convention, not a universal agent standard.

Clients that can POST may create an observation session and submit answers through `/api/agent/collect/site_local`. These events are labeled **agent reported**. Read-only clients can keep browsing without answering. See [the complete protocol and install examples](integrations.md).

For the demo specifically, requesting `/lab` with `Accept: application/json` returns HTTP 200, content and optional check-in context. A voluntary declaration does not grant permissions or change the observation token. Only the explicit advanced admission mode uses scoped grants, token rotation and protected API challenges. Its HTML questionnaire is HTTP 200 so browsers can read it.

## Data and evidence

Request headers are client-controlled claims. Browser properties and task answers can be invented. The UI deliberately separates **server observed**, **request header**, **browser reported**, **agent reported**, and **integration reported** evidence. No operator identity is cryptographically verified in this version.

Collected browser context includes user-agent, automation flag, language, timezone, platform, viewport/screen, available hardware hints, touch support and cookie capability. Request queries and referrer queries are stripped. Input contents and page text are not captured. A user's voluntarily supplied search query and questionnaire answers are recorded.

The collector can see a proxy or browser host's address rather than the end user's. Location and ASN are looked up locally in optional DB-IP Lite databases; individual visitor IPs are not sent to a lookup API. It does not collect TLS fingerprints, infer private prompts or guarantee detection of computer-use agents. Browser collection requires JavaScript; server reporting is best-effort and can lose events during an outage. See [network data, trust configuration and accuracy](network-data.md).

## Checks

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

API tests cover authentication, origin checks, answer validation, snapshots, permission enforcement, expiry/revocation, persistence, replay handling, exports and real HTTP agent traversal. Browser tests exercise dashboard inspection/export, browser check-in/navigation, custom-question persistence/mobile layout and collection on a separate local origin. UI tests run the compiled production server and use a disposable `.data/ui-tests.sqlite`, never the workspace database.

## Running beyond localhost

```sh
npm run build
HOST=0.0.0.0 ADMIN_PASSWORD='choose-a-long-private-password' npm start
```

Set the password through your deployment's private environment, not client code. Public-interface binding is refused without it. Use HTTPS. If a local reverse proxy terminates TLS, configure `TRUST_PROXY=loopback`; for other topologies, configure only the actual trusted proxy addresses. Without trusted proxy configuration, forwarded headers are not accepted as authoritative.

Configuration: `PORT` (default 3000), `HOST` (default 127.0.0.1), `DATABASE_PATH`, `ADMIN_PASSWORD`, `TRUST_PROXY`, `PUBLIC_URL` (public collector origin used in snippets and manifests), `GEOIP_CITY_PATH` and `GEOIP_ASN_PATH` (local DB-IP Lite MMDB files).

Hosted operation uses durable Turso and awaited storage calls; see [Vercel setup](vercel.md). Local SQLite statements execute synchronously behind the same async interface. This MVP supports separate customer workspaces with one website each; there is no durable ingestion queue or automatic retention job, and dashboard/export queries currently return the latest 300 visits; a visit timeline returns at most 1,500 events. The all-time chart displays the latest seven days. Records beyond display limits remain in SQLite. It is not a production multi-tenant service.

See [the stack and build status](build-status.md), [the implemented architecture](architecture.md).
