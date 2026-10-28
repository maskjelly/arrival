import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowClockwise,
  Bug,
  Eye,
  MagnifyingGlass,
  Robot,
  X,
  Info,
  DownloadSimple,
} from '@phosphor-icons/react';
import type { VisibilityFilters, VisibilityReport, TrafficType, Visit } from './types.ts';
import { ClientMark } from './ClientMark.tsx';
import './visibility.css';
export const trafficLabels: Record<TrafficType, string> = {
  crawler: 'Crawler',
  agent: 'Agent / fetcher',
  automation: 'Other automation',
  unidentified: 'Unclassified',
};
export function TrafficBadge({ kind }: { kind: TrafficType }) {
  return <span className={`traffic-badge traffic-${kind}`}>{trafficLabels[kind]}</span>;
}
export function visitPurpose(visit: Visit) {
  return (
    visit.objective ||
    (visit.visibility?.kind === 'crawler'
      ? (visit.attribution?.role ?? 'Crawler activity')
      : visit.visibility?.kind === 'automation'
        ? 'Automation observed'
        : visit.attribution?.role === 'User-requested retrieval'
          ? 'User-requested retrieval'
          : 'Task unknown')
  );
}
export function DiscoveryTrail({ visit }: { visit: Visit }) {
  const v = visit.visibility;
  if (!v) return null;
  return (
    <section className="discovery-trail" aria-label="Discovery and activity">
      <div className="discovery-title">
        <TrafficBadge kind={v.kind} />
        <span>
          {v.reasonBasis === 'declared'
            ? 'Agent-stated goal'
            : v.reasonBasis === 'published role'
              ? 'Published function'
              : 'Observed evidence'}
        </span>
      </div>
      <h3>{v.reason}</h3>
      <p>{v.kindBasis}</p>
      <ol className="discovery-steps">
        <li>
          <small>Arrived via</small>
          <strong>{v.source}</strong>
          {v.declaredSource && <span>Agent says: {v.declaredSource}</span>}
        </li>
        <li>
          <small>Search query</small>
          <strong>{v.query || 'Not supplied'}</strong>
          <span>
            {v.query ? 'From the referring URL' : 'The request did not disclose a search query.'}
          </span>
        </li>
        <li>
          <small>Landed on</small>
          <code>{v.entryPath}</code>
        </li>
        <li>
          <small>Latest recorded page</small>
          <code>{v.lastPath}</code>
        </li>
      </ol>
      {v.tags.length > 0 && (
        <div className="activity-tags">
          {v.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
      {v.kind === 'crawler' && (
        <p className="discovery-caption">
          Crawler roles describe their published function. They can discover pages through links,
          sitemaps or earlier crawls; no particular search or citation is implied.
        </p>
      )}
    </section>
  );
}
const n = (value: number) => value.toLocaleString();
const PAGE_SIZE = 15;
const visitWord = (value: number) => (value === 1 ? 'visit' : 'visits');
const agentWord = (value: number) => (value === 1 ? 'agent' : 'agents');
const crawlerWord = (value: number) => (value === 1 ? 'crawler' : 'crawlers');
const percent = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;
const roleSummary = (role: string) => {
  if (!role) return 'Role not published';
  if (/user-requested retrieval/i.test(role)) return 'User-requested retrieval';
  if (/seo analysis/i.test(role)) return 'SEO analysis';
  if (/web crawling/i.test(role)) return 'Web crawling';
  if (/self-reported/i.test(role)) return 'Self-reported introduction';
  if (/automation|http-client/i.test(role)) return 'HTTP client / automation';
  return role;
};
type ClientGroup = {
  provider: string;
  client: string;
  kind: TrafficType;
  role: string;
  visits: number;
  requests: number;
  pages: number;
  latest: string;
};
const groupedClients = (providers: VisibilityReport['providers'], kind: TrafficType) => {
  const groups = new Map<string, ClientGroup>();
  for (const item of providers) {
    if (item.kind !== kind) continue;
    const key = `${item.provider}|${item.client}`;
    const current = groups.get(key);
    if (current) {
      current.visits += item.visits;
      current.requests += item.requests;
      current.pages = Math.max(current.pages, item.pages);
    } else {
      groups.set(key, { ...item });
    }
  }
  return [...groups.values()].sort((a, b) => b.visits - a.visits);
};
type Tab = 'activity' | 'crawlers' | 'queries' | 'pages' | 'sources';
export default function Visibility({
  range,
  selectVisit,
  refreshKey,
}: {
  range: string;
  selectVisit: (id: string) => void;
  refreshKey: string;
}) {
  const [filters, setFilters] = useState<VisibilityFilters>({});
  const [tab, setTab] = useState<Tab>('activity');
  const [report, setReport] = useState<VisibilityReport>();
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((f) => ({ ...f, search: search || undefined, offset: 0 })),
      250,
    );
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setFilters((f) => ({ ...f, offset: 0 })), [range]);
  const serialized = JSON.stringify(filters);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    const params = new URLSearchParams({ range });
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') params.set(k, String(v));
    }
    fetch(`/api/admin/visibility?${params}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load visibility data.');
        return body as VisibilityReport;
      })
      .then(setReport)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [range, serialized, retry, refreshKey]);
  const update = (next: Partial<VisibilityFilters>) =>
    setFilters((f) => ({ ...f, ...next, offset: 0 }));
  const drill = (next: Partial<VisibilityFilters>) => {
    update(next);
    setTab('activity');
  };
  const active = Object.entries(filters).filter(
    ([key, value]) => !['includeDemo', 'offset', 'search'].includes(key) && value,
  );
  const total = report?.totals;
  const exportParams = new URLSearchParams({ range });
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'offset' && value !== undefined && value !== '')
      exportParams.set(key, String(value));
  }
  const composition = [
    { kind: 'crawler' as const, label: 'Crawlers', value: report?.totals.crawlers ?? 0 },
    { kind: 'agent' as const, label: 'Agents', value: report?.totals.agents ?? 0 },
    {
      kind: 'automation' as const,
      label: 'Other automation',
      value: report?.totals.automation ?? 0,
    },
    {
      kind: 'unidentified' as const,
      label: 'Unclassified',
      value: report?.totals.unidentified ?? 0,
    },
  ];
  const topPages = report?.pages.slice(0, 6) ?? [];
  const pageMaximum = Math.max(1, ...topPages.map((page) => page.visits));
  const directSource = report?.sources.find((source) => source.kind === 'unavailable');
  const referredSources =
    report?.sources.filter((source) => source.kind !== 'unavailable').slice(0, 5) ?? [];
  const sourceMaximum = Math.max(1, ...referredSources.map((source) => source.visits));
  const crawlerClients = report ? groupedClients(report.providers, 'crawler') : [];
  const agentClients = report ? groupedClients(report.providers, 'agent') : [];
  return (
    <div className="visibility-view" aria-busy={busy}>
      <div className="visibility-toolbar">
        <div className="visibility-search">
          <MagnifyingGlass size={16} />
          <input
            aria-label="Search visibility"
            placeholder="Search a client, query, page or goal"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Visitor type"
          value={filters.kind ?? ''}
          onChange={(e) =>
            update({ kind: (e.target.value || undefined) as TrafficType | undefined })
          }
        >
          <option value="">All visitor types</option>
          {Object.entries(trafficLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Visibility provider"
          value={filters.provider ?? ''}
          onChange={(e) => update({ provider: e.target.value || undefined, client: undefined })}
        >
          <option value="">All providers</option>
          {report?.providerOptions.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label className="demo-toggle">
          <input
            type="checkbox"
            checked={!!filters.includeDemo}
            onChange={(e) => update({ includeDemo: e.target.checked })}
          />
          Include demos
        </label>
        <a
          className="button secondary small"
          href={`/api/admin/visibility/export?${exportParams}`}
          download
        >
          <DownloadSimple size={14} />
          Export visits
        </a>
        <button
          className="icon-button"
          aria-label="Refresh visibility"
          onClick={() => setRetry((r) => r + 1)}
        >
          <ArrowClockwise size={16} />
        </button>
      </div>
      {active.length > 0 && (
        <div className="visibility-filter-chips">
          {active.map(([key, value]) => (
            <button
              key={key}
              onClick={() => update({ [key]: undefined })}
              aria-label={`Remove ${key} filter`}
            >
              {key}: {key === 'kind' ? trafficLabels[value as TrafficType] : String(value)}{' '}
              <X size={12} />
            </button>
          ))}
          <button
            onClick={() => {
              setFilters({ includeDemo: filters.includeDemo });
              setSearch('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setRetry((r) => r + 1)}>Retry</button>
        </div>
      )}
      {!report && !error ? (
        <div className="visibility-loading" role="status">
          Connecting your visit evidence…
        </div>
      ) : (
        report && (
          <>
            <section className="kpi-grid vis-kpi-grid" aria-label="Visibility summary">
              {[
                {
                  key: 'visits',
                  label: 'Visits observed',
                  value: total!.visits,
                  detail: `${n(total!.requests)} page events · ${n(total!.withDeclaration)} stated goals`,
                  icon: Eye,
                  action: () => {
                    update({ kind: undefined });
                    setTab('activity');
                  },
                  visual: (
                    <span className="vis-mini-stack" aria-hidden="true">
                      {composition
                        .filter((segment) => segment.value > 0)
                        .map((segment) => (
                          <i
                            key={segment.kind}
                            className={segment.kind}
                            style={{ flexGrow: segment.value }}
                          />
                        ))}
                    </span>
                  ),
                },
                {
                  key: 'crawlers',
                  label: 'Crawler visits',
                  value: total!.crawlers,
                  detail: `${percent(total!.crawlers, total!.visits)} · indexing, training, SEO`,
                  icon: Bug,
                  action: () => drill({ kind: 'crawler' }),
                  visual: (
                    <span className="vis-kpi-meter" aria-hidden="true">
                      <i
                        className="crawler"
                        style={{
                          width: `${total!.crawlers ? Math.max(2, (total!.crawlers / Math.max(1, total!.visits)) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  ),
                },
                {
                  key: 'agents',
                  label: 'Agent visits',
                  value: total!.agents,
                  detail: `${percent(total!.agents, total!.visits)} · user-directed retrieval`,
                  icon: Robot,
                  action: () => drill({ kind: 'agent' }),
                  visual: (
                    <span className="vis-kpi-meter" aria-hidden="true">
                      <i
                        className="agent"
                        style={{
                          width: `${total!.agents ? Math.max(2, (total!.agents / Math.max(1, total!.visits)) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  ),
                },
                {
                  key: 'queries',
                  label: 'Queries supplied',
                  value: total!.withQuery,
                  detail: `${percent(total!.withQuery, total!.visits)} disclosed a search query`,
                  icon: MagnifyingGlass,
                  action: () => setTab('queries'),
                  visual: (
                    <span className="vis-kpi-meter" aria-hidden="true">
                      <i
                        style={{
                          width: `${total!.withQuery ? Math.max(2, (total!.withQuery / Math.max(1, total!.visits)) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  ),
                },
              ].map((item) => (
                <button
                  type="button"
                  className="kpi-card vis-kpi"
                  key={item.key}
                  onClick={item.action}
                >
                  <span className="kpi-top">
                    <span className="kpi-label">{item.label}</span>
                    <span className="kpi-icon">
                      <item.icon size={15} weight="bold" aria-hidden="true" />
                    </span>
                  </span>
                  <strong className="kpi-value">{n(item.value)}</strong>
                  <span className="kpi-foot">
                    <span className="kpi-note">{item.detail}</span>
                    {item.visual}
                  </span>
                </button>
              ))}
            </section>

            <div className="vis-context">
              <span>
                <strong>{n(total!.visits)}</strong> {visitWord(total!.visits)}
              </span>
              <span>
                <strong>{n(total!.requests)}</strong> page events
              </span>
              <span>
                <strong>{n(total!.withDeclaration)}</strong> stated goals
              </span>
              <span>
                <strong>{n(total!.withSource)}</strong> with a referrer
              </span>
              <span className="vis-context-right">
                {report.scope.includeDemo
                  ? 'Demo traffic included'
                  : `${n(report.scope.excludedDemos)} demos excluded`}
              </span>
            </div>

            {total!.withQuery === 0 && (
              <div className="vis-query-note" role="note">
                <Info size={15} />
                <p>
                  <strong>No search query was disclosed in this period.</strong> Crawlers and fetch
                  clients usually omit a referrer. Pages and referral sources still show where
                  attention came from.
                </p>
                <button type="button" className="text-button" onClick={() => setTab('queries')}>
                  Open queries <ArrowRight size={13} />
                </button>
              </div>
            )}

            <div className="vis-insight-grid">
              <section className="panel vis-mix-panel" aria-labelledby="vis-mix-title">
                <div className="vis-panel-head">
                  <div>
                    <h2 id="vis-mix-title">Visitor mix</h2>
                    <p>Known crawlers, agents and the unclassified remainder</p>
                  </div>
                  <span className="quiet-count">
                    {n(total!.visits)} {visitWord(total!.visits)}
                  </span>
                </div>
                <div
                  className="vis-mix-bar"
                  role="img"
                  aria-label={composition
                    .map((segment) => `${segment.label}: ${segment.value}`)
                    .join(', ')}
                >
                  {composition
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                      <span
                        key={segment.kind}
                        className={`vis-mix-segment ${segment.kind}`}
                        style={{ flexGrow: segment.value }}
                        title={`${segment.label}: ${segment.value}`}
                      />
                    ))}
                </div>
                <ul className="vis-mix-legend">
                  {composition.map((segment) => (
                    <li key={segment.kind}>
                      <button type="button" onClick={() => drill({ kind: segment.kind })}>
                        <i className={`vis-dot ${segment.kind}`} />
                        <span>{segment.label}</span>
                        <strong>{n(segment.value)}</strong>
                        <small>{percent(segment.value, total!.visits)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="vis-panel-note">
                  <Info size={13} />
                  Labels use published roles and request evidence. “Unclassified” is not proof of a
                  human.
                </p>
              </section>

              <section className="panel vis-pages-panel" aria-labelledby="vis-pages-title">
                <div className="vis-panel-head">
                  <div>
                    <h2 id="vis-pages-title">Pages attracting attention</h2>
                    <p>Distinct visits recorded per path</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setTab('pages')}>
                    All pages <ArrowRight size={13} />
                  </button>
                </div>
                {topPages.length ? (
                  <div className="vis-rank-list">
                    {topPages.map((page) => (
                      <button
                        type="button"
                        className="vis-rank-row"
                        key={page.path}
                        onClick={() => drill({ page: page.path })}
                      >
                        <span className="vis-rank-label">
                          <code title={page.path}>{page.path}</code>
                          <small>
                            {n(page.agents)} {agentWord(page.agents)} · {n(page.crawlers)}{' '}
                            {crawlerWord(page.crawlers)}
                          </small>
                        </span>
                        <strong>{n(page.visits)}</strong>
                        <span className="vis-rank-track" aria-hidden="true">
                          <i style={{ width: `${(page.visits / pageMaximum) * 100}%` }} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="vis-panel-empty">
                    Page views appear once visitors browse the site.
                  </p>
                )}
                <p className="vis-panel-note">
                  One visit can touch several paths. Open a page to see its visitors.
                </p>
              </section>

              <section className="panel vis-sources-panel" aria-labelledby="vis-sources-title">
                <div className="vis-panel-head">
                  <div>
                    <h2 id="vis-sources-title">Where visits came from</h2>
                    <p>Referral evidence supplied with requests</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setTab('sources')}>
                    All sources <ArrowRight size={13} />
                  </button>
                </div>
                {directSource && (
                  <div className="vis-direct-source">
                    <div>
                      <span>Direct or undisclosed</span>
                      <strong>{n(directSource.visits)}</strong>
                    </div>
                    <span className="vis-rank-track" aria-hidden="true">
                      <i style={{ width: `${percent(directSource.visits, total!.visits)}` }} />
                    </span>
                    <small>
                      {percent(directSource.visits, total!.visits)} of visits supplied no referrer
                    </small>
                  </div>
                )}
                {referredSources.length ? (
                  <div className="vis-rank-list referred">
                    {referredSources.map((source) => (
                      <button
                        type="button"
                        className="vis-rank-row"
                        key={source.source}
                        onClick={() => drill({ source: source.source })}
                      >
                        <span className="vis-rank-label">
                          <span title={source.source}>{source.source}</span>
                          <small>
                            {source.kind === 'AI referral' ? 'AI referral' : 'Referring site'}
                          </small>
                        </span>
                        <strong>{n(source.visits)}</strong>
                        <span className="vis-rank-track" aria-hidden="true">
                          <i style={{ width: `${(source.visits / sourceMaximum) * 100}%` }} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="vis-panel-empty">
                    No identifying referrer was supplied in this period.
                  </p>
                )}
                <p className="vis-panel-note">
                  Referral text is separate from the connection’s network and location.
                </p>
              </section>
            </div>

            <section className="panel vis-clients-panel" aria-labelledby="vis-clients-title">
              <div className="vis-panel-head">
                <div>
                  <h2 id="vis-clients-title">Recognized visitors</h2>
                  <p>Published roles and observed activity, not private prompts</p>
                </div>
                <button type="button" className="text-button" onClick={() => setTab('crawlers')}>
                  All crawlers & agents <ArrowRight size={13} />
                </button>
              </div>
              <div className="vis-client-groups">
                <div className="vis-client-group">
                  <div className="vis-client-group-head">
                    <i className="vis-dot crawler" />
                    <h3>Crawlers</h3>
                    <span>
                      {n(total!.crawlers)} {visitWord(total!.crawlers)}
                    </span>
                  </div>
                  {crawlerClients.length ? (
                    crawlerClients.slice(0, 3).map((client) => (
                      <button
                        type="button"
                        className="vis-client-row"
                        key={`${client.provider}-${client.client}`}
                        onClick={() =>
                          drill({
                            provider: client.provider,
                            client: client.client,
                            kind: client.kind,
                          })
                        }
                      >
                        <ClientMark name={client.client} />
                        <span className="vis-client-main">
                          <strong>{client.client}</strong>
                          <small>
                            {client.provider} · {roleSummary(client.role)}
                          </small>
                          <small>
                            {n(client.requests)} events · {n(client.pages)} paths
                          </small>
                        </span>
                        <span className="vis-client-count">
                          <strong>{n(client.visits)}</strong>
                          <small>{client.visits === 1 ? 'visit' : 'visits'}</small>
                        </span>
                        <ArrowRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p className="vis-panel-empty">No published crawler visited this period.</p>
                  )}
                </div>
                <div className="vis-client-group">
                  <div className="vis-client-group-head">
                    <i className="vis-dot agent" />
                    <h3>Agents</h3>
                    <span>
                      {n(total!.agents)} {visitWord(total!.agents)}
                    </span>
                  </div>
                  {agentClients.length ? (
                    agentClients.slice(0, 3).map((client) => (
                      <button
                        type="button"
                        className="vis-client-row"
                        key={`${client.provider}-${client.client}`}
                        onClick={() =>
                          drill({
                            provider: client.provider,
                            client: client.client,
                            kind: client.kind,
                          })
                        }
                      >
                        <ClientMark name={client.client} />
                        <span className="vis-client-main">
                          <strong>{client.client}</strong>
                          <small>
                            {client.provider} · {roleSummary(client.role)}
                          </small>
                          <small>
                            {n(client.requests)} events · {n(client.pages)} paths
                          </small>
                        </span>
                        <span className="vis-client-count">
                          <strong>{n(client.visits)}</strong>
                          <small>{client.visits === 1 ? 'visit' : 'visits'}</small>
                        </span>
                        <ArrowRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p className="vis-panel-empty">No user-directed agent visited this period.</p>
                  )}
                </div>
              </div>
            </section>
            <section className="visibility-report panel">
              <div
                className="visibility-report-tabs"
                role="tablist"
                aria-label="Visibility reports"
              >
                {[
                  ['activity', 'Activity'],
                  ['crawlers', 'Crawlers & agents'],
                  ['queries', 'Search queries'],
                  ['pages', 'Pages'],
                  ['sources', 'Sources'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    id={`visibility-tab-${key}`}
                    aria-controls="visibility-panel"
                    aria-selected={tab === key}
                    tabIndex={tab === key ? 0 : -1}
                    onKeyDown={(e) => {
                      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                      e.preventDefault();
                      const tabs: Tab[] = ['activity', 'crawlers', 'queries', 'pages', 'sources'];
                      const i = tabs.indexOf(tab);
                      const next =
                        tabs[
                          e.key === 'Home'
                            ? 0
                            : e.key === 'End'
                              ? 4
                              : (i + (e.key === 'ArrowRight' ? 1 : 4)) % 5
                        ];
                      setTab(next);
                      document.getElementById(`visibility-tab-${next}`)?.focus();
                    }}
                    onClick={() => setTab(key as Tab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id="visibility-panel"
                aria-labelledby={`visibility-tab-${tab}`}
                className="visibility-panel"
                tabIndex={0}
              >
                <div className="visibility-report-heading">
                  <h2>
                    {
                      {
                        activity: 'From discovery to destination',
                        crawlers: 'Who is exploring your website',
                        queries: 'Searches disclosed with a visit',
                        pages: 'Pages attracting attention',
                        sources: 'Where visits arrived from',
                      }[tab]
                    }
                  </h2>
                  <p>
                    {
                      {
                        activity:
                          'Follow the evidence in each visit. Open a row for the full record.',
                        crawlers:
                          'Published roles distinguish scheduled crawling from user-directed retrieval.',
                        queries:
                          'Only queries supplied in a referring URL. Indexing crawls usually have no triggering search.',
                        pages:
                          'Distinct visits per recorded path. A visit can appear on several pages.',
                        sources:
                          'Referrals supplied with requests, independently of the connection’s country or network.',
                      }[tab]
                    }
                  </p>
                </div>
                {tab === 'activity' &&
                  (report.records.length ? (
                    <div className="visibility-table-wrap">
                      <table className="visibility-table">
                        <thead>
                          <tr>
                            <th>Visitor</th>
                            <th>Discovery</th>
                            <th>Goal or published function</th>
                            <th>Page journey</th>
                            <th>Page events</th>
                            <th>
                              <span className="sr-only">Inspect</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.records.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <span className="visibility-client">
                                  <ClientMark name={r.client} />
                                  <strong>{r.client}</strong>
                                </span>
                                <TrafficBadge kind={r.kind} />
                                <small>
                                  {r.confidence}
                                  {r.isDemo ? ' · Demo' : ''}
                                </small>
                              </td>
                              <td>
                                <strong>{r.source}</strong>
                                <small>{r.query ? `“${r.query}”` : 'Query not supplied'}</small>
                                {r.declaredSource && <small>Agent says: {r.declaredSource}</small>}
                              </td>
                              <td>
                                <strong>{r.reason}</strong>
                                <small>
                                  {r.reasonBasis === 'declared'
                                    ? 'Self-reported goal'
                                    : r.reasonBasis === 'published role'
                                      ? 'Published function; individual task not disclosed'
                                      : 'No declared purpose'}
                                </small>
                              </td>
                              <td>
                                <code title={r.entryPath}>{r.entryPath}</code>
                                {r.lastPath !== r.entryPath && (
                                  <>
                                    <span className="journey-connector">↓</span>
                                    <code title={r.lastPath}>{r.lastPath}</code>
                                  </>
                                )}
                                {r.tags.length > 0 && (
                                  <small>{r.tags.slice(0, 2).join(' · ')}</small>
                                )}
                              </td>
                              <td>
                                {n(r.requests)}
                                <small>
                                  {new Date(r.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </small>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Inspect visibility visit ${r.client}`}
                                  onClick={() => selectVisit(r.id)}
                                >
                                  <ArrowRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ReportEmpty
                      title="No visits match this view."
                      text="Change the filters or date range. New connected-site requests appear here automatically."
                    />
                  ))}
                {tab === 'crawlers' &&
                  (report.providers.length ? (
                    <div className="visibility-table-wrap">
                      <table className="visibility-table">
                        <thead>
                          <tr>
                            <th>Client / provider</th>
                            <th>Visitor type</th>
                            <th>Visits</th>
                            <th>Page events</th>
                            <th>Distinct paths</th>
                            <th>
                              <span className="sr-only">Explore</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.providers.map((p, i) => (
                            <tr key={`${p.client}-${i}`}>
                              <td>
                                <span className="visibility-client">
                                  <ClientMark name={p.client} />
                                  <strong>{p.client}</strong>
                                </span>
                                <small>{p.provider}</small>
                              </td>
                              <td>
                                <TrafficBadge kind={p.kind} />
                                <small>{p.role}</small>
                              </td>
                              <td>{n(p.visits)}</td>
                              <td>{n(p.requests)}</td>
                              <td>{n(p.pages)}</td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    drill({ provider: p.provider, client: p.client, kind: p.kind })
                                  }
                                >
                                  View visits <ArrowRight size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ReportEmpty
                      title="No client activity in this view."
                      text="Try a broader date range or remove a filter."
                    />
                  ))}
                {tab === 'queries' &&
                  (report.queries.length ? (
                    <div className="visibility-table-wrap">
                      <table className="visibility-table">
                        <thead>
                          <tr>
                            <th>Supplied query</th>
                            <th>Referring source</th>
                            <th>Visitor type</th>
                            <th>Landing page</th>
                            <th>Visits</th>
                            <th>
                              <span className="sr-only">Explore</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.queries.map((q, i) => (
                            <tr key={i}>
                              <td>
                                <strong>{q.query}</strong>
                                <small>Referrer evidence</small>
                              </td>
                              <td>
                                {q.source}
                                <small>{q.providers.join(', ')}</small>
                              </td>
                              <td>
                                <TrafficBadge kind={q.kind} />
                              </td>
                              <td>
                                <code>{q.page}</code>
                              </td>
                              <td>{q.visits}</td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    drill({
                                      query: q.query,
                                      source: q.source,
                                      kind: q.kind,
                                      page: q.page,
                                    })
                                  }
                                >
                                  View visits <ArrowRight size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ReportEmpty
                      title="These visits did not disclose a search query."
                      text="Search platforms and fetch tools commonly omit it. We can still show which crawlers arrived and the pages they explored. A crawler role or page title is not a search query."
                      action={() => setTab('pages')}
                      actionLabel="Explore visited pages"
                    />
                  ))}
                {tab === 'pages' &&
                  (report.pages.length ? (
                    <div className="visibility-table-wrap">
                      <table className="visibility-table">
                        <thead>
                          <tr>
                            <th>Page</th>
                            <th>Crawler visits</th>
                            <th>Agent visits</th>
                            <th>Providers</th>
                            <th>Known landing queries</th>
                            <th>
                              <span className="sr-only">Explore</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.pages.map((p) => (
                            <tr key={p.path}>
                              <td>
                                <code>{p.path}</code>
                                <small>{n(p.visits)} total visits</small>
                              </td>
                              <td>{p.crawlers}</td>
                              <td>{p.agents}</td>
                              <td>{p.providers.join(', ')}</td>
                              <td>
                                {p.queries.length
                                  ? p.queries.slice(0, 3).join(' · ')
                                  : 'Not supplied'}
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => drill({ page: p.path })}
                                >
                                  View visits <ArrowRight size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ReportEmpty
                      title="No pages recorded in this view."
                      text="Connected server requests and browser page views will populate this report."
                    />
                  ))}
                {tab === 'sources' &&
                  (report.sources.length ? (
                    <div className="visibility-table-wrap">
                      <table className="visibility-table">
                        <thead>
                          <tr>
                            <th>Referring source</th>
                            <th>Evidence</th>
                            <th>Visits</th>
                            <th>With a query</th>
                            <th>
                              <span className="sr-only">Explore</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.sources.map((s) => (
                            <tr key={s.source}>
                              <td>
                                <strong>{s.source}</strong>
                              </td>
                              <td>
                                {s.kind === 'unavailable'
                                  ? 'No referrer provided'
                                  : s.kind === 'AI referral'
                                    ? 'AI platform referral'
                                    : s.kind === 'internal'
                                      ? 'Same-site referral'
                                      : 'Supplied referring URL'}
                              </td>
                              <td>{s.visits}</td>
                              <td>{s.queries}</td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => drill({ source: s.source })}
                                >
                                  View visits <ArrowRight size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <ReportEmpty
                      title="No referral data in this view."
                      text="Try another date range or remove a filter."
                    />
                  ))}
              </div>
              <footer className="visibility-report-footer">
                <span>
                  {tab === 'activity'
                    ? `${report.records.length ? report.offset + 1 : 0}–${report.offset + report.records.length} of ${n(total!.visits)} ${visitWord(total!.visits)}`
                    : 'Click a row action to inspect its contributing visits.'}
                </span>
                {tab === 'activity' && (
                  <div>
                    <button
                      className="button secondary small"
                      disabled={!report.offset || busy}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          offset: Math.max(0, report.offset - PAGE_SIZE),
                        }))
                      }
                    >
                      Previous
                    </button>
                    <button
                      className="button secondary small"
                      disabled={!report.hasMore || busy}
                      onClick={() =>
                        setFilters((f) => ({ ...f, offset: report.offset + PAGE_SIZE }))
                      }
                    >
                      Next
                    </button>
                  </div>
                )}
              </footer>
            </section>
            <p className="visibility-method">
              {report.scope.capped
                ? `Report limited to the latest ${n(report.scope.limit)} visits. Narrow the date range for full coverage. `
                : ''}
              Page summaries include up to 100 recorded paths per visit. A visit does not prove an
              AI citation, recommendation or search ranking.
            </p>
          </>
        )
      )}
    </div>
  );
}
function ReportEmpty({
  title,
  text,
  action,
  actionLabel,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="visibility-empty">
      <MagnifyingGlass size={25} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button secondary" onClick={action}>
          {actionLabel}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
