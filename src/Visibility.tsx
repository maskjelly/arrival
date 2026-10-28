import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowClockwise,
  MagnifyingGlass,
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
const percent = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;
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
            <section className="visibility-metrics" aria-label="Visibility summary">
              {[
                {
                  name: 'Crawler visits',
                  value: total!.crawlers,
                  detail: 'Indexing, training and SEO',
                  kind: 'crawler',
                },
                {
                  name: 'Agent visits',
                  value: total!.agents,
                  detail: 'User-directed retrieval and declarations',
                  kind: 'agent',
                },
                {
                  name: 'Search queries supplied',
                  value: total!.withQuery,
                  detail: `${percent(total!.withQuery, total!.visits)} of filtered visits`,
                  view: 'queries',
                },
                {
                  name: 'Visits with a source',
                  value: total!.withSource,
                  detail: `${percent(total!.withSource, total!.visits)} referral coverage`,
                  view: 'sources',
                },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={() =>
                    item.kind ? drill({ kind: item.kind as TrafficType }) : setTab(item.view as Tab)
                  }
                >
                  <span>
                    {item.name}
                    <ArrowRight size={13} />
                  </span>
                  <strong>{n(item.value)}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </section>
            <div className="visibility-coverage">
              <div>
                <Info size={16} />
                <p>
                  <strong>{n(total!.visits)} visits in this view.</strong> {n(total!.automation)}{' '}
                  other automation · {n(total!.unidentified)} unclassified ·{' '}
                  {n(total!.withDeclaration)} stated goals.
                </p>
              </div>
              <span>
                {report.scope.includeDemo
                  ? 'Demo traffic included'
                  : `${report.scope.excludedDemos} demos excluded`}
              </span>
            </div>
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
                                <code>{r.entryPath}</code>
                                <span className="journey-connector">↓</span>
                                <code>{r.lastPath}</code>
                                <small>{r.tags.slice(0, 2).join(' · ')}</small>
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
                    ? `${report.records.length ? report.offset + 1 : 0}–${report.offset + report.records.length} of ${n(total!.visits)} visits`
                    : 'Click a row action to inspect its contributing visits.'}
                </span>
                {tab === 'activity' && (
                  <div>
                    <button
                      className="button secondary small"
                      disabled={!report.offset || busy}
                      onClick={() =>
                        setFilters((f) => ({ ...f, offset: Math.max(0, report.offset - 50) }))
                      }
                    >
                      Previous
                    </button>
                    <button
                      className="button secondary small"
                      disabled={!report.hasMore || busy}
                      onClick={() => setFilters((f) => ({ ...f, offset: report.offset + 50 }))}
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
