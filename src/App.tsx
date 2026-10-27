import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowRight,
  ArrowSquareOut,
  ArrowUp,
  ChartLineUp,
  Check,
  CheckCircle,
  Code,
  Copy,
  DownloadSimple,
  Eye,
  FileText,
  Globe,
  Info,
  Key,
  ListChecks,
  MagnifyingGlass,
  Path,
  Play,
  Plus,
  Robot,
  ShieldWarning,
  SignOut,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import BuildStatus from './BuildStatus.tsx';
import type { Overview, Question, Site, Visit, VisitEvent } from './types.ts';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'The request failed.', response.status);
  return data;
}
const date = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const time = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
const count = (value: number) =>
  new Intl.NumberFormat('en', { notation: value > 9999 ? 'compact' : 'standard' }).format(value);
const sourceName = (value: string) =>
  ({ gateway: 'Protected website', browser: 'Browser tracker', server: 'Server integration' })[
    value
  ] || value;
const eventName = (value: string) =>
  ({
    arrival: 'Visit started',
    gate_presented: 'Check-in requested',
    check_in: 'Purpose declared',
    purpose_declared: 'Purpose shared voluntarily',
    check_in_failed: 'Check-in incomplete',
    page_view: 'Page viewed',
    browser_context: 'Browser context collected',
    search: 'Site searched',
    download: 'File downloaded',
    shortlist_saved: 'Plan shortlisted',
    access_denied: 'Access denied',
    access_revoked: 'Access revoked',
    request: 'Request received',
    click: 'Control clicked',
    scroll: 'Page scrolled',
    visibility: 'Visibility changed',
    not_found: 'Page not found',
  })[value] || value;
const statusName = (value: string) =>
  ({
    awaiting: 'Awaiting check-in',
    admitted: 'Access granted',
    observed: 'Observed',
    revoked: 'Revoked',
    expired: 'Expired',
  })[value] || value;
type View = 'overview' | 'sessions' | 'questions' | 'integration' | 'project';

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'light' : ''}`}>
      <span className="brand-mark">
        <Path size={23} weight="bold" />
      </span>
      <span>
        arrival<span className="brand-period">.</span>
      </span>
    </div>
  );
}
function Status({ visit }: { visit: Visit }) {
  return (
    <span className={`status ${visit.status}`}>
      <i />
      {statusName(visit.status)}
    </span>
  );
}
function Avatar({ visit }: { visit: Visit }) {
  return (
    <span className={`avatar ${visit.isDemo ? 'demo-avatar' : ''}`}>
      {visit.classification === 'unknown' ? <Globe size={20} /> : <Robot size={21} />}
    </span>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Path size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [range, setRange] = useState('24h');
  const [data, setData] = useState<Overview>();
  const [login, setLogin] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [mobileNav, setMobileNav] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    const next = await api<Overview>(`/admin/overview?range=${range}`);
    setData(next);
    setLogin(false);
    return next;
  }, [range]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          try {
            await api('/auth/local', { method: 'POST' });
            if (live) await reload();
          } catch {
            if (live) setLogin(true);
          }
        } else if (live) setError((err as Error).message);
      } finally {
        if (live) setInitializing(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [reload]);
  useEffect(() => {
    if (login || initializing) return;
    let running = false;
    const interval = setInterval(async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await reload();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setLogin(true);
      } finally {
        running = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [reload, login, initializing]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const tell = (message: string) => setNotice(message);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };
  const runDemo = async () => {
    setDemoBusy(true);
    setError('');
    try {
      const result = await api<{ sessionId: string }>('/admin/run-demo', { method: 'POST' });
      await reload();
      setSelected(result.sessionId);
      tell('Demo check-in completed. Its actual requests are in the timeline.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDemoBusy(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      tell('Copied to clipboard.');
    } catch {
      tell('Clipboard access is unavailable. Select and copy the text.');
    }
  };
  if (initializing)
    return (
      <div className="loading">
        <Brand />
        <span className="spinner" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (login)
    return (
      <div className="login-screen">
        <div className="login-panel">
          <Brand />
          <h1>Your agent intelligence workspace.</h1>
          <p>Enter the owner password configured for this server.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              try {
                await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
                await reload();
                setPassword('');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label htmlFor="password">Owner password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="button primary">
              Open workspace <ArrowRight size={17} />
            </button>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <WarningCircle size={35} />
        <h2>Could not open Arrival</h2>
        <p>{error}</p>
        <button className="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  const views: { id: View; name: string; icon: typeof Path }[] = [
    { id: 'overview', name: 'Overview', icon: ChartLineUp },
    { id: 'sessions', name: 'Visits', icon: Path },
    { id: 'questions', name: 'Questions', icon: ListChecks },
    { id: 'integration', name: 'Connect a website', icon: Code },
    { id: 'project', name: 'Built & next', icon: ListChecks },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <a href="/" aria-label="Arrival home">
          <Brand light />
        </a>
        <div className="workspace">
          <span className="workspace-symbol">N</span>
          <div>
            <strong>{data.site.name}</strong>
            <small>Agent intelligence</small>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>
        <div className="nav-label">Workspace</div>
        <nav>
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => {
                setView(item.id);
                setMobileNav(false);
              }}
            >
              <item.icon size={19} weight={view === item.id ? 'duotone' : 'regular'} />
              {item.name}
              {item.id === 'sessions' && data.stats.visits > 0 && (
                <span className="nav-count">{count(data.stats.visits)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldWarning size={21} />
          <strong>Evidence, with context.</strong>
          <p>Declared purpose and observed activity stay separate. Identity is unverified.</p>
        </div>
        <a className="sidebar-link" href="/lab" target="_blank" rel="noreferrer">
          Explore the demo website <ArrowSquareOut size={16} />
        </a>
        <div className="sidebar-bottom">
          <span className="owner-avatar">You</span>
          <div>
            <strong>Local workspace</strong>
            <small>Single operator</small>
          </div>
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={async () => {
              await api('/auth/logout', { method: 'POST' });
              setLogin(true);
            }}
          >
            <SignOut size={18} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMobileNav((v) => !v)}
          >
            <ListChecks size={22} />
          </button>
          <a className="dashboard-home" href="/">
            arrival.
          </a>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{views.find((v) => v.id === view)?.name}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i />
              Connected
            </span>
            <button
              className={`icon-button ${refreshing ? 'rotating' : ''}`}
              onClick={refresh}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <ArrowClockwise size={18} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <WarningCircle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {(view === 'overview' || view === 'sessions') && (
            <>
              <div className="page-heading">
                <div>
                  <div className="section-context">{data.site.name} / Website activity</div>
                  <h1>{view === 'overview' ? 'Agent traffic' : 'Visit explorer'}</h1>
                  <p>
                    {view === 'overview'
                      ? 'Requests, declared objectives, and activity on your website.'
                      : 'Follow the task behind a visit, from check-in to the final action.'}
                  </p>
                </div>
                <div className="heading-actions">
                  <select
                    aria-label="Date range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="all">All time</option>
                  </select>
                  <a className="button secondary" href="/api/admin/export?format=csv" download>
                    <DownloadSimple size={17} />
                    Export
                  </a>
                </div>
              </div>
              {view === 'overview' ? (
                <OverviewPage
                  data={data}
                  runDemo={runDemo}
                  demoBusy={demoBusy}
                  selectVisit={setSelected}
                  showVisits={() => setView('sessions')}
                  range={range}
                />
              ) : (
                <VisitsPage
                  data={data}
                  selectVisit={setSelected}
                  runDemo={runDemo}
                  demoBusy={demoBusy}
                />
              )}
            </>
          )}
          {view === 'questions' && (
            <QuestionsPage
              site={data.site}
              save={async (next) => {
                await api('/admin/site', { method: 'PUT', body: JSON.stringify(next) });
                await reload();
                tell('Questions saved. New visits will use the updated version.');
              }}
            />
          )}
          {view === 'integration' && (
            <IntegrationPage
              site={data.site}
              copy={copy}
              save={async (next) => {
                await api('/admin/site', { method: 'PUT', body: JSON.stringify(next) });
                await reload();
                tell('Website settings saved.');
              }}
            />
          )}
          {view === 'project' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="section-context">The current build</div>
                  <h1>Built, and still to build.</h1>
                  <p>The implementation, its limits, and the stack underneath.</p>
                </div>
              </div>
              <BuildStatus />
            </>
          )}
          <footer className="app-footer">
            <span>Refreshes every 5 seconds</span>
            <span>
              Last synced{' '}
              {new Date(data.serverTime).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle size={19} weight="fill" />
          {notice}
        </div>
      )}
      {selected && (
        <VisitDrawer
          id={selected}
          close={() => setSelected(undefined)}
          reload={reload}
          copy={copy}
        />
      )}
    </div>
  );
}

function OverviewPage({
  data,
  runDemo,
  demoBusy,
  selectVisit,
  showVisits,
  range,
}: {
  data: Overview;
  runDemo: () => void;
  demoBusy: boolean;
  selectVisit: (id: string) => void;
  showVisits: () => void;
  range: string;
}) {
  const stats = [
    {
      label: 'Visits observed',
      value: data.stats.visits,
      detail: `${data.stats.demo} controlled demo${data.stats.demo === 1 ? '' : 's'}`,
      icon: Path,
    },
    {
      label: 'Purposes declared',
      value: data.stats.answered,
      detail: 'Answers supplied at check-in',
      icon: ListChecks,
    },
    {
      label: 'Access granted',
      value: data.stats.admitted,
      detail: 'Sessions with an active grant',
      icon: CheckCircle,
    },
    {
      label: 'Events captured',
      value: data.stats.events,
      detail: 'Requests, context, and actions',
      icon: Eye,
    },
  ];
  return (
    <>
      <div className="stats-strip">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-label">
              {s.label}
              <s.icon size={17} />
            </div>
            <strong>{count(s.value)}</strong>
            <small>{s.detail}</small>
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel traffic-panel">
          <div className="panel-heading">
            <div>
              <h2>Traffic over time</h2>
              <p>
                {range === 'all' ? 'Last 7 days of activity' : 'Arrivals and recorded activity'}
              </p>
            </div>
            <div className="legend">
              <span>
                <i className="legend-line teal" />
                Events
              </span>
              <span>
                <i className="legend-line pale" />
                Visits
              </span>
            </div>
          </div>
          <TrafficChart points={data.chart} empty={!data.stats.events} />
        </section>
        <section className="panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Request clients</h2>
              <p>Names inferred from request headers</p>
            </div>
            <Globe size={19} />
          </div>
          {data.sources.length ? (
            <div className="source-list">
              {data.sources.map((source, index) => (
                <div className="source-row" key={source.name}>
                  <span className={`source-icon color-${index}`}>
                    <Robot size={18} />
                  </span>
                  <div>
                    <strong>{source.name}</strong>
                    <small>Unverified identity</small>
                  </div>
                  <b>{source.count}</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="small-empty">
              <Globe size={29} />
              <p>Client names appear after your first visit.</p>
            </div>
          )}
          <div className="panel-footnote">
            <Info size={14} />A request header can be impersonated.
          </div>
        </section>
      </div>
      <section className="panel visits-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent visits</h2>
            <p>Declared intentions alongside the activity you observed.</p>
          </div>
          <button className="text-button" onClick={showVisits}>
            View all visits <ArrowRight size={16} />
          </button>
        </div>
        {data.sessions.length ? (
          <VisitTable visits={data.sessions.slice(0, 5)} selectVisit={selectVisit} />
        ) : (
          <Empty
            title="Your first arrival starts here."
            action={
              <div className="inline-actions">
                <button className="button primary" disabled={demoBusy} onClick={runDemo}>
                  <Play size={16} weight="fill" />
                  {demoBusy ? 'Running a real HTTP visit…' : 'Run a demo agent'}
                </button>
                <a className="button secondary" href="/lab" target="_blank" rel="noreferrer">
                  Visit the demo website <ArrowSquareOut size={16} />
                </a>
              </div>
            }
          >
            Send a controlled agent through check-in, then explore its answers and timeline. Nothing
            is pre-populated.
          </Empty>
        )}
      </section>
      <div className="bottom-grid">
        <section className="panel pages-panel">
          <div className="panel-heading">
            <div>
              <h2>Where visitors went</h2>
              <p>Page views on instrumented websites</p>
            </div>
            <FileText size={19} />
          </div>
          {data.pages.length ? (
            <div className="pages-list">
              {data.pages.map((page) => (
                <div key={page.path}>
                  <span>
                    <FileText size={16} />
                    <code>{page.path}</code>
                  </span>
                  <strong>
                    {page.count}
                    <small> views</small>
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="quiet-empty">
              Page paths appear after an admitted visitor starts browsing.
            </p>
          )}
        </section>
        <section className="start-panel">
          <span className="start-symbol">
            <ListChecks size={24} />
          </span>
          <div>
            <h2>Ask a better first question.</h2>
            <p>
              Collect objectives, discovery sources, evaluation criteria, and your own custom
              questions.
            </p>
            <a className="text-button" href="/lab" target="_blank" rel="noreferrer">
              Try the check-in experience <ArrowSquareOut size={16} />
            </a>
          </div>
        </section>
      </div>
      {data.sessions.length > 0 && (
        <div className="demo-control">
          <span>Want another complete example?</span>
          <button className="text-button" disabled={demoBusy} onClick={runDemo}>
            <Play size={14} />
            {demoBusy ? 'Running…' : 'Run a controlled HTTP agent'}
          </button>
        </div>
      )}
    </>
  );
}

function TrafficChart({ points, empty }: { points: Overview['chart']; empty: boolean }) {
  const width = 700,
    height = 180,
    left = 34,
    right = 12,
    top = 15,
    bottom = 28;
  const maximum = Math.max(4, ...points.flatMap((p) => [p.visits, p.events]));
  const x = (i: number) => left + (i * (width - left - right)) / Math.max(1, points.length - 1);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / maximum);
  const line = (key: 'events' | 'visits') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[key])}`).join(' ');
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={empty ? 'No traffic recorded yet.' : 'Event and visit counts over time.'}
      >
        <defs>
          <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ed80b3" stopOpacity=".13" />
            <stop offset="100%" stopColor="#ed80b3" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line
              x1={left}
              x2={width - right}
              y1={y(maximum * r)}
              y2={y(maximum * r)}
              stroke="#eee3e9"
              strokeDasharray="3 5"
            />
            <text
              x={left - 10}
              y={y(maximum * r) + 4}
              textAnchor="end"
              fill="#776a73"
              fontSize="10"
            >
              {Math.round(maximum * r)}
            </text>
          </g>
        ))}
        {!empty && (
          <>
            <path
              d={`${line('events')} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              fill="url(#traffic-fill)"
            />
            <path
              d={line('visits')}
              fill="none"
              stroke="#383037"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <path d={line('events')} fill="none" stroke="#d967a0" strokeWidth="2.4" />
            {points.map((p, i) => (
              <circle
                key={p.time}
                cx={x(i)}
                cy={y(p.events)}
                r={p.events > 0 ? 3 : 0}
                fill="#d967a0"
              >
                <title>
                  {date(p.time)}: {p.events} events, {p.visits} visits
                </title>
              </circle>
            ))}
          </>
        )}
        {points
          .filter(
            (_p, i) =>
              i % Math.max(1, Math.floor((points.length - 1) / 4)) === 0 || i === points.length - 1,
          )
          .map((p) => (
            <text
              key={p.time}
              x={x(points.indexOf(p))}
              y={height - 4}
              textAnchor={points.indexOf(p) === points.length - 1 ? 'end' : 'middle'}
              fill="#776a73"
              fontSize="10"
            >
              {points.length > 7
                ? new Date(p.time).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date(p.time).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
            </text>
          ))}
      </svg>
      {empty && (
        <div className="chart-empty">
          <span>No recorded activity yet</span>
          <small>Your live traffic will appear here.</small>
        </div>
      )}
    </div>
  );
}

function VisitTable({
  visits,
  selectVisit,
}: {
  visits: Visit[];
  selectVisit: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="visit-table">
        <thead>
          <tr>
            <th>Visitor</th>
            <th>Declared objective</th>
            <th>Status</th>
            <th>Activity</th>
            <th>Arrived</th>
            <th>
              <span className="sr-only">Open visit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => (
            <tr key={visit.id}>
              <td>
                <button className="visitor-cell" onClick={() => selectVisit(visit.id)}>
                  <Avatar visit={visit} />
                  <span>
                    <strong>{visit.agentName}</strong>
                    <small>{visit.isDemo ? 'Controlled demo' : sourceName(visit.source)}</small>
                  </span>
                </button>
              </td>
              <td>
                <p className={`objective ${visit.objective ? '' : 'not-provided'}`}>
                  {visit.objective || 'No purpose declared'}
                </p>
              </td>
              <td>
                <Status visit={visit} />
              </td>
              <td>
                <span className="activity-count">
                  {visit.pageCount} <small>pages</small>
                  <span>·</span>
                  {visit.eventCount} <small>events</small>
                </span>
              </td>
              <td>
                <span className="date-cell">{date(visit.createdAt)}</span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Inspect ${visit.agentName}`}
                  onClick={() => selectVisit(visit.id)}
                >
                  <ArrowRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisitsPage({
  data,
  selectVisit,
  runDemo,
  demoBusy,
}: {
  data: Overview;
  selectVisit: (id: string) => void;
  runDemo: () => void;
  demoBusy: boolean;
}) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [channel, setChannel] = useState('all');
  const visits = useMemo(
    () =>
      data.sessions.filter(
        (v) =>
          (!search ||
            `${v.agentName} ${v.objective} ${v.id} ${v.entryPath}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (status === 'all' || v.status === status) &&
          (channel === 'all' || channel === 'demo'
            ? channel === 'all' || v.isDemo
            : v.source === channel),
      ),
    [data, search, status, channel],
  );
  return (
    <section className="panel">
      <div className="visits-toolbar">
        <div className="search-input">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search visits"
            placeholder="Search visitors, objectives, or IDs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {['awaiting', 'admitted', 'observed', 'revoked', 'expired'].map((s) => (
            <option key={s} value={s}>
              {statusName(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by collection source"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="all">All sources</option>
          <option value="gateway">Protected website</option>
          <option value="browser">Browser tracker</option>
          <option value="server">Server integration</option>
          <option value="demo">Controlled demos</option>
        </select>
      </div>
      <div className="results-label">
        {visits.length} visit{visits.length !== 1 ? 's' : ''} shown
        {data.total > 300 ? ` · Latest 300 of ${data.total}` : ''}
      </div>
      {visits.length ? (
        <VisitTable visits={visits} selectVisit={selectVisit} />
      ) : (
        <Empty
          title={data.sessions.length ? 'No matching visits.' : 'No visits recorded yet.'}
          action={
            !data.sessions.length ? (
              <button className="button primary" disabled={demoBusy} onClick={runDemo}>
                <Play size={16} />
                Run a demo agent
              </button>
            ) : (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                  setChannel('all');
                }}
              >
                Clear filters
              </button>
            )
          }
        >
          {data.sessions.length
            ? 'Try another search or remove a filter.'
            : 'Visit the protected demo or connect a website to collect your first session.'}
        </Empty>
      )}
    </section>
  );
}

function QuestionsPage({
  site,
  save,
}: {
  site: Site;
  save: (next: Omit<Site, 'id' | 'questionsVersion' | 'hasIngestKey'>) => Promise<void>;
}) {
  const [questions, setQuestions] = useState<Question[]>(() => structuredClone(site.questions)),
    [required, setRequired] = useState(site.requireAdmission),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const update = (index: number, change: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...change } : q)));
  const move = (index: number, amount: number) =>
    setQuestions((qs) => {
      const copy = [...qs];
      [copy[index], copy[index + amount]] = [copy[index + amount], copy[index]];
      return copy;
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-context">Check-in configuration</div>
          <h1>Ask what matters to you.</h1>
          <p>Give each arrival a little context. Answers stay attached to the visit.</p>
        </div>
        <button
          className="button primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError('');
            try {
              await save({
                name: site.name,
                origin: site.origin,
                requireAdmission: required,
                questions,
              });
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Check size={17} />
          {saving ? 'Saving…' : 'Save questions'}
        </button>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="questions-layout">
        <div>
          <section className="panel admission-policy">
            <div>
              <strong>Require check-in on the protected demo</strong>
              <p>Every demo visitor declares a purpose before accessing the content.</p>
            </div>
            <button
              className={`switch ${required ? 'on' : ''}`}
              role="switch"
              aria-checked={required}
              aria-label="Require check-in"
              onClick={() => setRequired((v) => !v)}
            >
              <span />
            </button>
          </section>
          <div className="question-list">
            {questions.map((q, index) => (
              <section className="panel question-card" key={q.id}>
                <div className="question-card-top">
                  <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
                  <strong>
                    {q.type === 'textarea'
                      ? 'Long answer'
                      : q.type === 'select'
                        ? 'Single choice'
                        : q.type === 'multiselect'
                          ? 'Multiple choice'
                          : 'Short answer'}
                  </strong>
                  <div className="question-tools">
                    <button
                      className="icon-button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move question ${index + 1} up`}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={index === questions.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move question ${index + 1} down`}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      disabled={questions.length <= 1}
                      onClick={() => setQuestions((qs) => qs.filter((item) => item.id !== q.id))}
                      aria-label={`Remove question ${index + 1}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                <label className="sr-only" htmlFor={`label-${q.id}`}>
                  Question {index + 1} wording
                </label>
                <input
                  id={`label-${q.id}`}
                  className="question-label"
                  value={q.label}
                  maxLength={180}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
                <div className="question-settings">
                  <label>
                    Answer type
                    <select
                      aria-label={`Question ${index + 1} answer type`}
                      value={q.type}
                      onChange={(e) =>
                        update(index, {
                          type: e.target.value as Question['type'],
                          options:
                            e.target.value.includes('select') && !q.options.length
                              ? ['Option 1', 'Option 2']
                              : q.options,
                        })
                      }
                    >
                      <option value="text">Short answer</option>
                      <option value="textarea">Long answer</option>
                      <option value="select">Single choice</option>
                      <option value="multiselect">Multiple choice</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => update(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <code>{q.id}</code>
                </div>
                {q.type.includes('select') && (
                  <label className="options-label">
                    Options, one per line
                    <textarea
                      aria-label={`Question ${index + 1} options`}
                      value={q.options.join('\n')}
                      onChange={(e) => update(index, { options: e.target.value.split('\n') })}
                      rows={Math.min(6, q.options.length + 1)}
                    />
                  </label>
                )}
              </section>
            ))}
          </div>
          <button
            className="add-question"
            disabled={questions.length >= 20}
            onClick={() =>
              setQuestions((qs) => [
                ...qs,
                {
                  id: `q_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
                  label: 'What else should we know about your task?',
                  type: 'text',
                  required: false,
                  options: [],
                },
              ])
            }
          >
            <Plus size={19} />
            Add a custom question<span>{questions.length}/20</span>
          </button>
        </div>
        <aside className="question-aside">
          <div className="note-icon">
            <ListChecks size={25} />
          </div>
          <h3>Intent is more than a page view.</h3>
          <p>A few useful things to ask:</p>
          <ul>
            <li>What are you evaluating?</li>
            <li>Which constraints matter?</li>
            <li>What brought you here?</li>
            <li>What would success look like?</li>
          </ul>
          <div className="aside-divider" />
          <strong>Keep it answerable.</strong>
          <p>Ask for a task summary, not private user details or the full original prompt.</p>
          <strong>Past answers stay intact.</strong>
          <p>
            Each visit keeps the question version it saw. Editing these questions affects new
            visits.
          </p>
          <a className="button secondary" href="/lab" target="_blank" rel="noreferrer">
            Open the live gate <ArrowSquareOut size={15} />
          </a>
          <small>To see a new version, use a new browser session or an HTTP client.</small>
        </aside>
      </div>
    </>
  );
}

function CodeBlock({ value, copy }: { value: string; copy: (value: string) => void }) {
  return (
    <div className="code-block">
      <button title="Copy code" aria-label="Copy code" onClick={() => copy(value)}>
        <Copy size={17} />
      </button>
      <pre>{value}</pre>
    </div>
  );
}
function IntegrationPage({
  site,
  copy,
  save,
}: {
  site: Site;
  copy: (value: string) => void;
  save: (next: Omit<Site, 'id' | 'questionsVersion' | 'hasIngestKey'>) => Promise<void>;
}) {
  const [name, setName] = useState(site.name),
    [origin, setOrigin] = useState(site.origin),
    [key, setKey] = useState(''),
    [checkIn, setCheckIn] = useState('agents'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const base = window.location.origin;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-context">Collection setup</div>
          <h1>Turn visits into evidence.</h1>
          <p>Start with the protected demo, then connect browser or server activity.</p>
        </div>
      </div>
      <div className="integration-grid">
        <div className="integration-main">
          <section className="panel setup-panel">
            <div className="setup-heading">
              <Globe size={24} />
              <div>
                <h2>Your website</h2>
                <p>The browser collector only accepts this exact origin.</p>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await save({
                    name,
                    origin,
                    questions: site.questions,
                    requireAdmission: site.requireAdmission,
                  });
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                <label>
                  Display name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Website origin
                  <input
                    type="url"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    required
                    placeholder="https://example.com"
                  />
                </label>
              </div>
              <button className="button secondary" disabled={busy}>
                Save website
              </button>
            </form>
          </section>
          <section className="panel setup-panel">
            <div className="setup-heading">
              <Code size={24} />
              <div>
                <h2>Browser tracker & optional check-in</h2>
                <p>Collect browser context, activity, and answers to your questions.</p>
              </div>
              <span className="integration-tag">Public script</span>
            </div>
            <label className="collector-mode">
              Show the optional questionnaire
              <select
                aria-label="Browser check-in mode"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              >
                <option value="agents">For suspected automation</option>
                <option value="all">For every visitor</option>
                <option value="off">Track only</option>
              </select>
            </label>
            <CodeBlock
              value={`<script defer\n  src="${base}/tracker.js"\n  data-site="${site.id}"\n  data-check-in="${checkIn}">\n</script>`}
              copy={copy}
            />
            <p className="setup-note">
              Add this to your website. To track a control, add{' '}
              <code>data-arrival-track="Compare plans"</code>. Form input values and page contents
              are not collected.
            </p>
            <div className="inline-note">
              <Info size={17} />
              <p>
                Suspected automation uses basic browser signals and can miss agents. The optional
                questionnaire can be dismissed; server-side protection requires a separate gate.
                HTTP-only crawlers need server collection.
              </p>
            </div>
          </section>
          <section className="panel setup-panel">
            <div className="setup-heading">
              <Key size={24} />
              <div>
                <h2>Server-side collection</h2>
                <p>Record HTTP requests, including clients that never execute JavaScript.</p>
              </div>
              <span className="integration-tag">Private key</span>
            </div>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  const data = await api<{ key: string }>('/admin/ingest-key', { method: 'POST' });
                  setKey(data.key);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <Key size={16} />
              {site.hasIngestKey || key ? 'Rotate ingestion key' : 'Generate ingestion key'}
            </button>
            {key && (
              <div className="key-output">
                <code>{key}</code>
                <button
                  className="icon-button"
                  onClick={() => copy(key)}
                  aria-label="Copy ingestion key"
                >
                  <Copy size={17} />
                </button>
              </div>
            )}
            <p className="setup-note">
              Keys are shown once. Rotation immediately invalidates the previous key. Keep this key
              on your server.
            </p>
            <CodeBlock
              value={`import { arrivalAnalytics } from './sdk/arrival';\n\napp.use(arrivalAnalytics({\n  endpoint: '${base}',\n  key: process.env.ARRIVAL_INGEST_KEY,\n  sessionId: req => req.session.id,\n  onError: error => console.warn(error.message),\n}));`}
              copy={copy}
            />
            <p className="setup-note">
              Use the included Express middleware after your session middleware. Your session ID
              links requests; the collection adapter does not enforce admission.
            </p>
          </section>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>
        <aside>
          <section className="integration-aside">
            <span className="note-icon">
              <Robot size={27} />
            </span>
            <h3>Test the full journey.</h3>
            <p>
              The built-in Northstar website has a real server-side gate, a questionnaire, limited
              session grants and observed actions.
            </p>
            <a className="button primary" href="/lab" target="_blank" rel="noreferrer">
              Open protected demo <ArrowSquareOut size={16} />
            </a>
            <hr />
            <strong>HTTP agents are welcome.</strong>
            <p>
              Request <code>/lab</code> with <code>Accept: application/json</code>. The response
              explains the check-in contract.
            </p>
            <CodeBlock value={`curl -H 'Accept: application/json' \\\n  ${base}/lab`} copy={copy} />
          </section>
          <div className="integration-limits">
            <ShieldWarning size={20} />
            <h4>Know what is verified.</h4>
            <p>
              The MVP records request and browser evidence. It does not verify agent operators,
              infer private prompts, or collect TLS fingerprints.
            </p>
            <p>
              This server runs locally by default. A remote website needs a reachable HTTPS
              deployment.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function VisitDrawer({
  id,
  close,
  reload,
  copy,
}: {
  id: string;
  close: () => void;
  reload: () => Promise<Overview>;
  copy: (value: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<{ visit: Visit; events: VisitEvent[] }>();
  const [tab, setTab] = useState('answers'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setDetail(await api(`/admin/sessions/${id}`));
  }, [id]);
  useEffect(() => {
    void load().catch((err) => setError(err.message));
    dialog.current?.showModal();
    const interval = setInterval(() => void load().catch(() => {}), 5000);
    return () => clearInterval(interval);
  }, [load]);
  const visit = detail?.visit;
  return (
    <dialog
      className="visit-drawer"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const rect = dialog.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            close();
        }
      }}
      aria-label="Visit details"
    >
      <div className="drawer-shell">
        <header className="drawer-top">
          <span>Visit details</span>
          <button className="icon-button" aria-label="Close visit details" onClick={close}>
            <X size={21} />
          </button>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {visit && detail ? (
          <>
            <div className="drawer-identity">
              <Avatar visit={visit} />
              <div>
                <h2>{visit.agentName}</h2>
                <span>{visit.isDemo ? 'Controlled demonstration' : sourceName(visit.source)}</span>
              </div>
              <Status visit={visit} />
            </div>
            <div className="identity-note">
              <ShieldWarning size={17} />
              <span>Identity unverified. Names and objectives can be self-reported.</span>
            </div>
            <div className="drawer-metrics">
              <div>
                <small>Arrived</small>
                <strong>{date(visit.createdAt)}</strong>
              </div>
              <div>
                <small>Pages</small>
                <strong>{visit.pageCount}</strong>
              </div>
              <div>
                <small>Events</small>
                <strong>{visit.eventCount}</strong>
              </div>
              <div>
                <small>Classification</small>
                <strong>{visit.classification}</strong>
              </div>
            </div>
            <div className="drawer-tabs">
              {[
                ['answers', 'Task & answers'],
                ['activity', 'Activity'],
                ['signals', 'Signals'],
                ['raw', 'Raw data'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? 'active' : ''}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {key === 'activity' && <span>{detail.events.length}</span>}
                </button>
              ))}
            </div>
            <div className="drawer-content">
              {tab === 'answers' && (
                <>
                  {visit.objective ? (
                    <div className="objective-block">
                      <span>Declared objective</span>
                      <p>{visit.objective}</p>
                    </div>
                  ) : (
                    <div className="inline-note">
                      <Info size={18} />
                      <p>This visitor has not declared an objective.</p>
                    </div>
                  )}
                  <div className="answer-list">
                    {visit.questions.map((q) => (
                      <div key={q.id}>
                        <label>
                          {q.label}
                          <span>Self-reported</span>
                        </label>
                        <p
                          className={
                            !visit.answers[q.id] ||
                            (Array.isArray(visit.answers[q.id]) && !visit.answers[q.id].length)
                              ? 'muted'
                              : ''
                          }
                        >
                          {Array.isArray(visit.answers[q.id])
                            ? (visit.answers[q.id] as string[]).join(', ') || 'Not provided'
                            : visit.answers[q.id] || 'Not provided'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="permission-box">
                    <h3>Granted permissions</h3>
                    <div className="permission-list">
                      {visit.permissions.length ? (
                        visit.permissions.map((permission) => (
                          <span key={permission}>
                            <Check size={13} />
                            {permission}
                          </span>
                        ))
                      ) : (
                        <span>No admission grant</span>
                      )}
                    </div>
                    <p>
                      Question version {visit.questionsVersion}
                      {visit.status === 'admitted' ? ` · Expires ${date(visit.expiresAt)}` : ''}
                    </p>
                  </div>
                </>
              )}
              {tab === 'activity' && (
                <div className="timeline">
                  {detail.events.map((event) => (
                    <article key={event.id}>
                      <span className={`event-node ${event.type === 'check_in' ? 'success' : ''}`}>
                        {event.type === 'check_in' ? (
                          <Check size={13} />
                        ) : event.type === 'page_view' ? (
                          <FileText size={13} />
                        ) : (
                          <span />
                        )}
                      </span>
                      <div>
                        <div className="event-heading">
                          <strong>{eventName(event.type)}</strong>
                          <time>{time(event.createdAt)}</time>
                        </div>
                        <code>
                          {event.method} {event.path}
                        </code>
                        <div className="event-meta">
                          <span>{event.source}</span>
                          {event.status !== null && (
                            <span className={event.status >= 400 ? 'error-text' : ''}>
                              {event.status}
                            </span>
                          )}
                        </div>
                        {Object.keys(event.data).length > 0 && (
                          <details>
                            <summary>Event details</summary>
                            <pre>{JSON.stringify(event.data, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {tab === 'signals' && (
                <>
                  <div className="inline-note">
                    <Info size={18} />
                    <p>
                      These are observations and client reports. No cryptographic operator
                      verification or geolocation service is connected.
                    </p>
                  </div>
                  <div className="signal-list">
                    {visit.evidence.map((signal, index) => (
                      <div key={`${signal.name}-${index}`}>
                        <div>
                          <strong>{signal.name}</strong>
                          <span
                            className={`evidence-source ${signal.source.startsWith('browser') ? 'client' : ''}`}
                          >
                            {signal.source}
                          </span>
                        </div>
                        <code>{signal.value}</code>
                        {signal.note && <p>{signal.note}</p>}
                      </div>
                    ))}
                  </div>
                  <dl className="extra-signals">
                    <dt>Entry path</dt>
                    <dd>{visit.entryPath}</dd>
                    <dt>Referring page</dt>
                    <dd>{visit.referrer || 'Not provided'}</dd>
                    <dt>Visit ID</dt>
                    <dd>
                      <code>{visit.id}</code>
                    </dd>
                  </dl>
                </>
              )}
              {tab === 'raw' && (
                <>
                  <div className="raw-heading">
                    <p>Complete visit record, without session credentials.</p>
                    <button
                      className="button secondary small"
                      onClick={() => copy(JSON.stringify(detail, null, 2))}
                    >
                      <Copy size={15} />
                      Copy JSON
                    </button>
                  </div>
                  <pre className="raw-data">{JSON.stringify(detail, null, 2)}</pre>
                </>
              )}
            </div>
            <footer className="drawer-footer">
              <a className="button secondary" href={`/api/admin/export?session=${id}`} download>
                <DownloadSimple size={16} />
                Export visit
              </a>
              <button
                className="text-button danger"
                disabled={busy || visit.status === 'revoked'}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/admin/sessions/${id}/revoke`, { method: 'POST' });
                    await load();
                    await reload();
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {visit.status === 'revoked' ? 'Access revoked' : 'Revoke session access'}
              </button>
            </footer>
          </>
        ) : (
          <div className="loading">
            <span className="spinner" />
            <p>Loading this visit…</p>
          </div>
        )}
      </div>
    </dialog>
  );
}
