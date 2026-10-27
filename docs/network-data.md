# Location and network data

Arrival records the address visible to the collector, then resolves approximate location and ASN ownership using local DB-IP Lite databases. It does not send each visitor's IP to an external lookup API. Questions and website access work without these databases.

## Enable

In **Connect a website → Location & network intelligence**, choose **Download free IP databases**. The owner-only endpoint starts a background download and shows progress. Alternatively:

```sh
npm run geo:update
# Optional historical release, if still offered by DB-IP:
npm run geo:update -- 2026-10
```

The CLI installs `.data/geo/city.mmdb` and `.data/geo/asn.mmdb`. Restart a running server after CLI updates; dashboard updates reload immediately. `GEOIP_CITY_PATH` and `GEOIP_ASN_PATH` override these paths. Use DB-IP Lite MMDB files, not arbitrary provider databases. The app verifies their database type before loading. Database files and downloads are excluded from Git.

Downloads use HTTPS, gzip expansion limits, a timeout, temporary files and per-file atomic replacement. Lookup failures do not interrupt collection or website access. Updating from the dashboard reprocesses the latest 300 visits; startup also reprocesses that window when databases are available. Older records remain stored. A failed download keeps existing in-memory readers active.

DB-IP publishes monthly Lite releases. Update monthly; the UI flags databases older than 45 days. There is no automatic update scheduler. Expect roughly 65 MB of downloads and 140 MB installed, plus working space during replacement.

## What is saved

| Field             | Meaning and source                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Arrival IP        | Original address captured for the visit; retained when the address changes                  |
| Latest exit IP    | Normalized IPv4 or IPv6 address, public/private scope and capture time                      |
| Capture source    | Direct connection, configured trusted proxy, integration reported, or legacy stored address |
| Collector peer    | Actual socket peer for requests observed by Arrival; often the local reverse proxy          |
| Location          | Approximate continent, country, region and city when present in DB-IP Lite                  |
| Coordinates       | IP-derived estimate rounded to two decimal places; never GPS                                |
| ASN               | Network number, organization and matched network prefix length                              |
| Hosting hint      | Conservative organization-name match, explicitly inferred; unknown when unmatched           |
| Lookup provenance | Dataset source, build dates and lookup status/time                                          |
| Address history   | Up to eight recent captured addresses and their capture sources                             |
| Request context   | Method, protocol, scheme and a small allowlist of headers                                   |

Allowed headers: `accept`, `accept-language`, `accept-encoding`, `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-fetch-site`, `sec-fetch-mode`, `sec-fetch-dest`, `dnt`, `sec-gpc`, `purpose` and `sec-purpose`. Cookies, authorization and arbitrary headers are excluded. User agent and query-stripped referrer are already separate visit fields. Collector HTTP version describes the collector connection, which may differ from the visitor-to-CDN connection.

Browser context includes available language/timezone, viewport/screen, pixel ratio, color depth, low-entropy browser brands, touch support, hardware hints, connection estimates, reduced-motion and privacy preference flags. Availability varies by browser. These are browser-reported values, not verified facts. Arrival does not request GPS, high-entropy client hints, canvas fingerprints, unrelated page text or private prompts. Recording DNT/GPC flags does not itself implement a consent policy; hosts can use the tracker's disable switch with their existing consent controls.

## Trust the right connection

Direct requests use the socket address. Express accepts forwarding headers only through `TRUST_PROXY`; leave this unset unless a known reverse proxy is in front of Arrival. Configure the actual proxy addresses and prevent direct access around that proxy. With `TRUST_PROXY=loopback`, every process on the local machine can act as a trusted proxy. Never expose a local forwarding facade that blindly relays caller-supplied IP headers.

The Express host adapter uses the host application's `req.ip`. Configure that application's proxy trust just as carefully. Server ingestion labels the result **integration reported**: a private ingestion key authorizes reporting but does not independently verify the reported original connection.

Web Request runtimes do not provide a standard socket IP. Pass `clientIp` only when obtained from trusted platform metadata:

```ts
await reportArrival(request, {
  endpoint: process.env.ARRIVAL_URL!,
  key: process.env.ARRIVAL_INGEST_KEY,
  sessionId,
  clientIp: trustedClientIp, // optional; obtained through your deployment's trusted interface
});
```

The generic Next.js example omits this value because its safe source depends on the deployment. Arrival leaves the visitor IP unknown when absent; it never substitutes the reporting server's address. Browser snippets see the collector-facing exit address without a server adapter. HTTP-only website requests still require a host/log integration.

## Read the evidence correctly

- An exit IP can belong to a VPN, residential proxy, CDN or remote browser service. It may hide the agent's actual host.
- ASN ownership identifies a network operator. A Google or Amazon network does not prove a particular agent vendor, cloud account or hosting product.
- IP-derived city/coordinates are approximate and can be wrong. They do not locate the human using an agent.
- This MVP does not verify VPN use, recover an origin behind a proxy, inspect TLS fingerprints or cryptographically verify agent operators.
- Forwarding headers and browser/agent declarations can be forged. Their provenance stays visible.

The **Origins** view summarizes countries and network operators for the selected range. The connection list shows the latest 300 visits and supports IP, city, ASN and agent search. Open a visit's **Network** tab for provenance and headers. JSON and CSV exports include network data and attribution. IPs are stored in plaintext in the owner database; automatic retention and deletion controls remain future work.

## Data license and accuracy

IP geolocation and ASN data are provided by [DB-IP](https://db-ip.com) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). UI views and exports retain attribution; keep it when redistributing derived data. DB-IP Lite has reduced coverage/accuracy compared with its paid products and no equivalent QA guarantee. See the [Lite databases](https://db-ip.com/db/lite.php), [FAQ](https://db-ip.com/faq.php), [city dataset](https://db-ip.com/db/download/ip-to-city-lite) and [ASN dataset](https://db-ip.com/db/download/ip-to-asn-lite). The local reader uses [node-maxmind](https://github.com/runk/node-maxmind).
