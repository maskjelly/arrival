import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowClockwise,
  CheckCircle,
  Copy,
  DownloadSimple,
  Globe,
  MapPin,
  Stack,
} from '@phosphor-icons/react';
import type { NetworkStatus, Overview, Visit } from './types.ts';

export const locationName = (visit: Visit) => {
  const n = visit.network;
  if (n?.location?.countryCode)
    return [n.location.city, n.location.countryCode].filter(Boolean).join(', ');
  if (n?.scope && n.scope !== 'public' && n.scope !== 'unknown') return 'Non-public address';
  return 'Location unavailable';
};
export function NetworkBadge({ visit }: { visit: Visit }) {
  return (
    <span className="network-badge">
      <span>
        <MapPin size={12} aria-hidden="true" />
        {locationName(visit)}
      </span>
      <small title={visit.network?.asn?.organization}>
        {visit.network?.asn?.organization || visit.network?.ip || visit.ip || 'IP not reported'}
      </small>
    </span>
  );
}
export function OriginStrip({ network, open }: { network: Overview['network']; open: () => void }) {
  return (
    <div className="origin-strip">
      <span className="origin-strip-icon">
        <Globe size={17} />
      </span>
      <div>
        <strong>Connection origins</strong>
        <span>
          {network.located} of {network.total} visits located · {network.asnResolved} networks
          resolved
        </span>
      </div>
      <button className="text-button" onClick={open}>
        Explore origins <ArrowRight size={14} />
      </button>
    </div>
  );
}
export function OriginsPage({
  data,
  selectVisit,
  setup,
  range,
  onRangeChange,
}: {
  data: Overview;
  selectVisit: (id: string) => void;
  setup: () => void;
  range: string;
  onRangeChange: (range: string) => void;
}) {
  const [country, setCountry] = useState(''),
    [provider, setProvider] = useState(''),
    [search, setSearch] = useState('');
  const network = data.network;
  const visits = data.sessions.filter(
    (v) =>
      (!country || v.network?.location?.countryCode === country) &&
      (!provider || v.network?.asn?.organization === provider) &&
      (!search ||
        [
          v.agentName,
          v.objective,
          v.network?.ip,
          v.ip,
          v.network?.location?.city,
          v.network?.location?.region,
          v.network?.location?.country,
          v.network?.asn?.organization,
          v.network?.asn?.number,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-context">Network intelligence</div>
          <h1>Where visits connect from</h1>
          <p>IP-derived location and network ownership. The connection may belong to a proxy.</p>
        </div>
        <div className="heading-actions">
          <select
            aria-label="Date range"
            value={range}
            onChange={(e) => onRangeChange(e.target.value)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <button className="button secondary" onClick={setup}>
            Manage IP data <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="stats-strip origin-stats">
        {[
          ['Public connections', network.publicAddresses, 'Visits with a public exit address'],
          ['Locations resolved', network.located, 'Approximate country or city'],
          ['Networks resolved', network.asnResolved, 'ASN ownership from local data'],
          ['Countries observed', network.countryCount, 'Distinct countries in this time range'],
        ].map(([label, value, note]) => (
          <div className="stat" key={label}>
            <div className="stat-label">{label}</div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="origins-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Connection locations</h2>
              <p>Estimated from the exit IP, not the user’s location</p>
            </div>
            <MapPin size={18} />
          </div>
          {network.countries.length ? (
            <div className="origin-rank-list">
              {network.countries.map((c) => (
                <button
                  key={c.code}
                  aria-pressed={country === c.code}
                  onClick={() => setCountry(country === c.code ? '' : c.code)}
                >
                  <span className="country-code">{c.code}</span>
                  <span>{c.name || c.code}</span>
                  <strong>{c.count}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="origin-empty">
              <MapPin size={24} />
              <p>No locations resolved yet.</p>
              <small>
                {network.status.enabled
                  ? 'Private addresses and unmatched IPs stay unknown.'
                  : 'Install the free local IP databases to enable estimates.'}
              </small>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Network operators</h2>
              <p>Who operates the observed IP address range</p>
            </div>
            <Stack size={18} />
          </div>
          {network.providers.length ? (
            <div className="origin-rank-list">
              {network.providers.map((p) => (
                <button
                  key={p.name}
                  aria-pressed={provider === p.name}
                  onClick={() => setProvider(provider === p.name ? '' : p.name)}
                >
                  <span className="network-initial">{p.name.slice(0, 1)}</span>
                  <span>{p.name}</span>
                  <strong>{p.count}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="origin-empty">
              <Stack size={24} />
              <p>No network operators resolved yet.</p>
              <small>ASN ownership appears when a public IP matches the local dataset.</small>
            </div>
          )}
        </section>
      </div>
      <section className="panel origin-visits">
        <div className="panel-heading">
          <div>
            <h2>Connection evidence</h2>
            <p>
              Showing {visits.length} of the latest {data.sessions.length} visits
            </p>
          </div>
          {(country || provider || search) && (
            <button
              className="text-button"
              onClick={() => {
                setCountry('');
                setProvider('');
                setSearch('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="origin-search">
          <input
            aria-label="Search connection evidence"
            placeholder="Search an IP, agent, city, or network…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {country && <span className="filter-chip">Country: {country}</span>}
          {provider && <span className="filter-chip">Network: {provider}</span>}
        </div>
        {visits.length ? (
          <div className="origin-evidence-list">
            {visits.map((v) => (
              <button
                key={v.id}
                onClick={() => selectVisit(v.id)}
                aria-label={`Inspect network for ${v.agentName}`}
              >
                <span className="origin-evidence-agent">
                  <strong>{v.agentName}</strong>
                  <small>{v.network?.ipSource || 'Not captured'}</small>
                </span>
                <code>{v.network?.ip || v.ip || 'IP not reported'}</code>
                <NetworkBadge visit={v} />
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="origin-empty">
            <p>No visits match these filters.</p>
          </div>
        )}
      </section>
      <p className="network-attribution">
        IP geolocation and ASN data by{' '}
        <a href="https://db-ip.com" target="_blank" rel="noreferrer">
          DB-IP
        </a>
        . Location is approximate; hosting labels are inferred. A network operator is not a verified
        agent identity.
      </p>
    </>
  );
}
export function NetworkDetails({ visit, copy }: { visit: Visit; copy: (value: string) => void }) {
  const n = visit.network;
  return (
    <div className="network-details">
      <div className="network-address-card">
        <span>Observed exit address</span>
        <div>
          <code>{n?.ip || visit.ip || 'Not reported'}</code>
          {(n?.ip || visit.ip) && (
            <button
              className="icon-button"
              aria-label="Copy IP address"
              onClick={() => copy(n?.ip || visit.ip)}
            >
              <Copy size={16} />
            </button>
          )}
        </div>
        <small>
          {n?.ipSource || 'Legacy record'} · {n?.version ? `IPv${n.version}` : 'Unknown version'} ·{' '}
          {n?.scope || 'Unknown scope'}
        </small>
      </div>
      <div className="network-detail-grid">
        <section>
          <MapPin size={17} />
          <h3>Approximate location</h3>
          <strong>{n?.location?.city || n?.location?.country || 'Not resolved'}</strong>
          <p>
            {[n?.location?.region, n?.location?.country].filter(Boolean).join(', ') ||
              (n?.scope && n.scope !== 'public'
                ? 'A non-public address has no public location.'
                : 'A public IP and a matching location database are needed.')}
          </p>
          {n?.location?.latitude !== undefined && n.location.longitude !== undefined && (
            <code>
              {n.location.latitude.toFixed(2)}, {n.location.longitude.toFixed(2)} · IP estimate
            </code>
          )}
        </section>
        <section>
          <Stack size={17} />
          <h3>Network ownership</h3>
          <strong>{n?.asn ? `AS${n.asn.number}` : 'Not resolved'}</strong>
          <p>{n?.asn?.organization || 'No ASN match is available.'}</p>
          {n?.hosting && <span className="hosting-hint">{n.hosting.provider} · inferred</span>}
        </section>
      </div>
      <div className="inline-note">
        <p>
          This is the agent’s visible network exit. A VPN, proxy or browser service can hide its
          actual host. This data does not locate the person using the agent or verify who operates
          it.
        </p>
      </div>
      <dl className="network-facts">
        <dt>Capture source</dt>
        <dd>{n?.ipSource || 'Not recorded'}</dd>
        <dt>Collector peer</dt>
        <dd>
          <code>{n?.peerIp || 'Not recorded'}</code>
        </dd>
        <dt>IP data status</dt>
        <dd>{n?.enrichment.status || 'Not captured'}</dd>
        <dt>Location database</dt>
        <dd>
          {n?.enrichment.cityBuiltAt
            ? new Date(n.enrichment.cityBuiltAt).toLocaleDateString()
            : 'Not installed or not used'}
        </dd>
        <dt>ASN database</dt>
        <dd>
          {n?.enrichment.asnBuiltAt
            ? new Date(n.enrichment.asnBuiltAt).toLocaleDateString()
            : 'Not installed or not used'}
        </dd>
        <dt>Request protocol</dt>
        <dd>
          {n?.request.httpVersion
            ? `HTTP/${n.request.httpVersion} at ${n.ipSource === 'integration reported' ? 'host server' : 'collector'}`
            : 'Not reported'}
          {n?.request.scheme ? ` · ${n.request.scheme.toUpperCase()}` : ''}
        </dd>
        <dt>Proxy / VPN</dt>
        <dd>Not verified</dd>
      </dl>
      {(n?.history?.length ?? 0) > 1 && (
        <section className="network-history">
          <h3>Recent address changes</h3>
          <p>Up to eight captured addresses for this visit.</p>
          {n!.history!.map((h, i) => (
            <div key={h.observedAt + i}>
              <code>{h.ip}</code>
              <time>{new Date(h.observedAt).toLocaleString()}</time>
            </div>
          ))}
        </section>
      )}
      <details className="network-request">
        <summary>Observed request headers ({Object.keys(n?.request.headers ?? {}).length})</summary>
        <p>
          Selected headers only. Cookies, authorization and private request bodies are excluded.
          These describe the reporting connection; server adapters report their own observed request
          metadata.
        </p>
        <pre tabIndex={0}>{JSON.stringify(n?.request.headers ?? {}, null, 2)}</pre>
      </details>
      {n?.enrichment.source && (
        <p className="network-attribution">
          IP data by{' '}
          <a href="https://db-ip.com" target="_blank" rel="noreferrer">
            DB-IP
          </a>{' '}
          · CC BY 4.0 · Local lookup
        </p>
      )}
    </div>
  );
}
export function NetworkSetup() {
  const [status, setStatus] = useState<NetworkStatus>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch('/api/admin/network');
        if (!r.ok) throw new Error('Could not load IP data status.');
        const s = await r.json();
        if (live) setStatus(s);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="panel setup-panel network-setup">
      <div className="setup-heading">
        <Globe size={23} />
        <div>
          <h2>Location & network intelligence</h2>
          <p>
            Resolve country, city and network operator locally. No API key or per-visit lookup
            request.
          </p>
        </div>
      </div>
      <div className="database-states">
        {(['city', 'asn'] as const).map((key) => (
          <div key={key}>
            <span>{key === 'city' ? 'Location database' : 'ASN database'}</span>
            <strong>
              {status?.[key].available ? (
                <>
                  <CheckCircle size={13} /> Ready
                </>
              ) : (
                'Not installed'
              )}
            </strong>
            <small>
              {status?.[key].builtAt
                ? `Built ${new Date(status[key].builtAt!).toLocaleDateString()}${status[key].stale ? ' · Update recommended' : ''}`
                : 'Free DB-IP Lite dataset'}
            </small>
          </div>
        ))}
      </div>
      <button
        className="button secondary"
        disabled={busy || status?.job.running || status?.updatesManaged}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const r = await fetch('/api/admin/network/update', { method: 'POST' });
            if (!r.ok) throw new Error('Could not start the database update.');
            setStatus(await r.json());
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {status?.job.running ? <ArrowClockwise size={15} /> : <DownloadSimple size={15} />}{' '}
        {status?.updatesManaged
          ? 'Updated during deployment'
          : status?.job.running
            ? 'Updating IP data…'
            : status?.enabled
              ? 'Update databases'
              : 'Download free IP databases'}
      </button>
      {status?.job.running && (
        <p className="setup-note" role="status">
          {status.job.stage}
          {status.job.downloadedBytes
            ? ` · ${(status.job.downloadedBytes / 1048576).toFixed(1)} MB received`
            : ''}
          . Website access stays available.
        </p>
      )}
      {(error || status?.job.error) && (
        <p className="error-text setup-note" role="alert">
          {error || status?.job.error}
        </p>
      )}
      <p className="setup-note">
        Local IPv4 and IPv6 lookup. No visitor IP is sent to a geolocation API. Updating reprocesses
        the latest 300 saved visits. Cloud/hosting labels are inferred from ASN organization names;
        proxies and VPNs remain unverified.
      </p>
      <p className="network-attribution">
        Data by{' '}
        <a href="https://db-ip.com" target="_blank" rel="noreferrer">
          DB-IP
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        . GeoIP is approximate. Download is about 65 MB compressed; about 140 MB installed, with
        extra working space during updates.
      </p>
    </section>
  );
}
