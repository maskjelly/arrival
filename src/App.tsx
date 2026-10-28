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
import { motionIsInstant, softEase } from './motion.ts';
import { ActivityChart } from './ActivityChart.tsx';
import { ClientMark } from './ClientMark.tsx';
import { CustomerSetup } from './CustomerSetup.tsx';
import BuildStatus from './BuildStatus.tsx';
import InstallGuide from './InstallGuide.tsx';
import {
  NetworkBadge,
  NetworkDetails,
  NetworkSetup,
  OriginStrip,
  OriginsPage,
} from './Network.tsx';
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
  ({
    gateway: 'Demo website',
    browser: 'Browser tracker',
    server: 'Server integration',
    agent: 'Agent declaration',
  })[value] || value;
const eventName = (value: string) =>
  ({
    arrival: 'Visit started',
    gate_presented: 'Check-in requested',
    check_in: 'Purpose declared',
    purpose_declared: 'Purpose shared voluntarily',
    entry_observed: 'Fetch-only client allowed without questions',
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
    network_changed: 'Connection address changed',
  })[value] || value;
const statusName = (value: string) =>
  ({
    awaiting: 'Awaiting check-in',
    admitted: 'Access granted',
    observed: 'Observed',
    revoked: 'Revoked',
    expired: 'Expired',
  })[value] || value;
type View = 'overview' | 'sessions' | 'origins' | 'questions' | 'integration' | 'project';

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
      <ClientMark name={visit.agentName} size={20} />
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
  const readView = () => {
    const value = new URLSearchParams(location.search).get('view');
    return (
      ['overview', 'sessions', 'origins', 'questions', 'integration', 'project'].includes(
        value ?? '',
      )
        ? value
        : 'overview'
    ) as View;
  };
  const [view, setCurrentView] = useState<View>(readView);
  const setView = (next: View) => {
    const url = new URL(location.href);
    url.searchParams.set('view', next);
    history.pushState({}, '', url);
    setCurrentView(next);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const back = () => setCurrentView(readView());
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  const workspaceSlug = location.pathname.match(/^\/app\/([a-z0-9-]+)/)?.[1];
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
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNav(false);
        requestAnimationFrame(() => menuButton.current?.focus());
      }
    };
    const desktop = matchMedia('(min-width: 901px)');
    const close = () => {
      if (desktop.matches) setMobileNav(false);
    };
    document.addEventListener('keydown', escape);
    desktop.addEventListener('change', close);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', escape);
      desktop.removeEventListener('change', close);
    };
  }, [mobileNav]);
  const reload = useCallback(async () => {
    const next = await api<Overview>(`/admin/overview?range=${range}`);
    if (workspaceSlug && next.site.workspace !== workspaceSlug)
      throw new ApiError('Sign into this workspace.', 401);
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
            if (workspaceSlug) throw new Error('Customer sign-in required.');
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
          <h1>Good to see you again.</h1>
          <p>
            {workspaceSlug
              ? `Your ${workspaceSlug} workspace. Enter the password you chose during setup.`
              : 'Enter your workspace password.'}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              try {
                await api('/auth/login', {
                  method: 'POST',
                  body: JSON.stringify({
                    password,
                    ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
                  }),
                });
                await reload();
                setPassword('');
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <label htmlFor="password">
              {workspaceSlug ? 'Workspace password' : 'Owner password'}
            </label>
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
    { id: 'origins', name: 'Origins', icon: Globe },
    { id: 'questions', name: 'Questions', icon: ListChecks },
    { id: 'integration', name: 'Connect a website', icon: Code },
    { id: 'project', name: 'Built & next', icon: ListChecks },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace content
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => {
            setMobileNav(false);
            requestAnimationFrame(() => menuButton.current?.focus());
          }}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}
        aria-label="Workspace navigation"
      >
        <a href="/" aria-label="Arrival home">
          <Brand />
        </a>
        <div className="workspace">
          <span className="workspace-symbol">{data.site.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{data.site.name}</strong>
            <small>{new URL(data.site.origin).hostname}</small>
          </div>
        </div>

        <nav aria-label="Workspace pages">
          {views.map((item) => (
            <a
              key={item.id}
              href={`${location.pathname}?view=${item.id}`}
              aria-current={view === item.id ? 'page' : undefined}
              className={`${view === item.id ? 'active' : ''} ${item.id === 'project' ? 'secondary-nav' : ''}`}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                setView(item.id);
                setMobileNav(false);
                requestAnimationFrame(() => document.getElementById('workspace-main')?.focus());
              }}
            >
              <item.icon
                size={19}
                weight={view === item.id ? 'duotone' : 'regular'}
                aria-hidden="true"
              />
              {item.name}
              {item.id === 'sessions' && data.stats.visits > 0 && (
                <span className="nav-count">{count(data.stats.visits)}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="observation-dot" />
          <strong>Observability first</strong>
          <p>
            {data.site.entryMode === 'ask'
              ? 'Agents introduce their task, then continue.'
              : 'Visits are observed without an entry question.'}
          </p>
        </div>
        <a className="sidebar-link" href={data.site.origin} target="_blank" rel="noreferrer">
          Open website <ArrowSquareOut size={16} />
        </a>
        <div className="sidebar-bottom">
          <span className="owner-avatar">You</span>
          <div>
            <strong>{data.site.workspace ?? data.site.name}</strong>
            <small>Customer workspace</small>
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
      <div className="app-body" inert={mobileNav}>
        <header className="topbar">
          <button
            ref={menuButton}
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            aria-expanded={mobileNav}
            aria-controls="workspace-navigation"
            onClick={() => setMobileNav((v) => !v)}
          >
            <ListChecks size={22} />
          </button>
          <a className="dashboard-home" href="/">
            arrival.
          </a>
          <div className="breadcrumb">
            <strong>{views.find((v) => v.id === view)?.name}</strong>
            <span>/</span>
            <span className="workspace-domain">{new URL(data.site.origin).hostname}</span>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i />
              Workspace synced
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
        <main className="main-content" id="workspace-main" tabIndex={-1}>
          {error && (
            <div className="error-banner" role="alert">
              <WarningCircle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="workspace-view" key={view}>
            {(view === 'overview' || view === 'sessions') && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="section-context">Website analytics</div>
                    <h1>{view === 'overview' ? 'Agent traffic' : 'Visit explorer'}</h1>
                    <p>
                      {view === 'overview'
                        ? 'A little context for everyone stopping by.'
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
                    connectSite={() => setView('integration')}
                    editQuestions={() => setView('questions')}
                    openOrigins={() => setView('origins')}
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
            {view === 'origins' && data.network && (
              <OriginsPage
                data={data}
                selectVisit={setSelected}
                setup={() => setView('integration')}
                range={range}
                onRangeChange={setRange}
              />
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
          </div>
          <footer className="app-footer">
            <span>
              Refreshes every 5 seconds
              {data.network?.status.enabled && (
                <>
                  {' '}
                  · IP data by{' '}
                  <a href="https://db-ip.com" target="_blank" rel="noreferrer">
                    DB-IP
                  </a>
                </>
              )}
            </span>
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
          initialTab={view === 'origins' ? 'network' : 'answers'}
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
  connectSite,
  editQuestions,
  openOrigins,
}: {
  openOrigins: () => void;
  connectSite: () => void;
  editQuestions: () => void;
  data: Overview;
  runDemo: () => void;
  demoBusy: boolean;
  selectVisit: (id: string) => void;
  showVisits: () => void;
  range: string;
}) {
  const [geography, setGeography] = useState<'country' | 'region'>('country');
  const stats = [
    {
      label: 'Visits observed',
      value: data.stats.visits,
      detail: 'Arrivals on your website',
      icon: Path,
    },
    {
      label: 'Purposes declared',
      value: data.stats.answered,
      detail: 'In the visitor’s own words',
      icon: ListChecks,
    },
    {
      label: 'Suspected automation',
      value: data.stats.automated,
      detail: 'From header or browser signals',
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
      <section className="panel overview-activity">
        <div className="stats-strip">
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="stat-label">{s.label}</div>
              <strong>{count(s.value)}</strong>
              <small>{s.detail}</small>
            </div>
          ))}
        </div>
        <ActivityChart points={data.chart} empty={!data.stats.events} />
        {range === 'all' && (
          <p className="chart-range-note">
            The chart shows the latest 7 days. Totals cover all time.
          </p>
        )}
      </section>
      {data.entry && (
        <section className="entry-funnel" aria-label="Agent entry funnel">
          <div>
            <span>Agent introductions</span>
            <p>A quick hello. Then back to the task.</p>
          </div>
          <ol>
            <li>
              <strong>{data.entry.prompted}</strong>
              <span>Questions shown</span>
            </li>
            <li>
              <strong>{data.entry.answered}</strong>
              <span>Answered</span>
            </li>
            <li>
              <strong>{data.entry.continued}</strong>
              <span>Continued browsing</span>
            </li>
          </ol>
          <small>
            Fetch-only visits read freely. Missing continuation is not proof of abandonment.
          </small>
        </section>
      )}
      <div className="overview-breakdowns">
        <section className="panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Request clients</h2>
              <p>Who’s been stopping by</p>
            </div>
            <span className="quiet-count">Visits</span>
          </div>
          {data.sources.length ? (
            <div className="source-list">
              {data.sources.map((source) => (
                <div className="source-row" key={source.name}>
                  <span
                    className="rank-fill"
                    style={{
                      width: '100%',
                      transform: `scaleX(${source.count / Math.max(1, data.stats.visits)})`,
                    }}
                  />
                  <ClientMark name={source.name} />
                  <strong>{source.name}</strong>
                  <b>{count(source.count)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="quiet-empty">
              Your visitors will introduce themselves here. When they can.
            </p>
          )}
          <div className="panel-footnote">
            <Info size={13} />
            Names come from headers, not verified identities.
          </div>
        </section>
        <section className="panel overview-places">
          <div className="panel-heading">
            <div className="geo-tabs" role="group" aria-label="Overview location breakdown">
              <button
                aria-pressed={geography === 'country'}
                onClick={() => setGeography('country')}
              >
                Countries
              </button>
              <button aria-pressed={geography === 'region'} onClick={() => setGeography('region')}>
                States & regions
              </button>
            </div>
            <span className="quiet-count">Visits</span>
          </div>
          {(geography === 'country' ? data.network.countries : (data.network.regions ?? []))
            .length ? (
            <div className="overview-location-list">
              {(geography === 'country' ? data.network.countries : (data.network.regions ?? []))
                .slice(0, 5)
                .map((place, i) => (
                  <div key={place.name + String(i)}>
                    <span
                      className="rank-fill"
                      style={{
                        width: '100%',
                        transform: `scaleX(${place.count / Math.max(1, data.stats.visits)})`,
                      }}
                    />
                    <span className="country-code">
                      {'code' in place ? place.code : place.countryCode}
                    </span>
                    <strong>{place.name}</strong>
                    <b>{count(place.count)}</b>
                  </div>
                ))}
            </div>
          ) : (
            <p className="quiet-empty">A small world, once your first visitors arrive.</p>
          )}
          <div className="panel-footnote">
            <span>Approximate location of the connection.</span>
            <button className="text-button" onClick={openOrigins}>
              Explore origins <ArrowRight size={13} />
            </button>
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
                <button className="button primary" onClick={connectSite}>
                  <Code size={16} />
                  Connect a website
                </button>
                {!data.site.workspace && (
                  <button
                    className="button secondary"

                    disabled={demoBusy}
                    onClick={runDemo}
                  >
                    <Play size={16} weight="fill" />
                    {demoBusy ? 'Running a real HTTP visit…' : 'Run a demo agent'}
                  </button>
                )}
                <a
                  className="button secondary"
                  href={data.site.origin}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit your website <ArrowSquareOut size={16} />
                </a>
              </div>
            }
          >
            Once connected, incoming visits appear here. Open your website with an agent to see its
            first trail. Your customer data starts empty.
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
            <p className="quiet-empty">Page paths appear as visitors browse your website.</p>
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
            <button className="text-button" onClick={editQuestions}>
              Edit check-in questions <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
      {data.sessions.length > 0 && !data.site.workspace && (
        <div className="demo-control">
          <span>Want another complete example?</span>
          {!data.site.workspace && (
            <button
              className="text-button"

              disabled={demoBusy}
              onClick={runDemo}
            >
              <Play size={14} />
              {demoBusy ? 'Running…' : 'Run a controlled HTTP agent'}
            </button>
          )}
        </div>
      )}
    </>
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
    <>
      <div
        className="table-scroll desktop-visits"
        tabIndex={0}
        role="region"
        aria-label="Visit records"
      >
        <table className="visit-table">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Declared objective</th>
              <th>Connection origin</th>
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
                    {visit.objective || 'Intent unknown'}
                  </p>
                </td>
                <td>
                  <NetworkBadge visit={visit} />
                </td>
                <td>
                  <Status visit={visit} />
                </td>
                <td>
                  <span className="activity-count">
                    {visit.source === 'server' ? (visit.requestCount ?? 0) : visit.pageCount}{' '}
                    <small>{visit.source === 'server' ? 'requests' : 'page views'}</small>
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
      <ul className="mobile-visit-list" aria-label="Recent visit records">
        {visits.map((visit) => (
          <li key={visit.id}>
            <button
              className="mobile-visit-card"
              aria-label={`Inspect ${visit.agentName}`}
              onClick={() => selectVisit(visit.id)}
            >
              <span className="mobile-visit-heading">
                <Avatar visit={visit} />
                <strong>{visit.agentName}</strong>
                <Status visit={visit} />
              </span>
              <span className={`mobile-visit-objective ${visit.objective ? '' : 'muted'}`}>
                {visit.objective || 'Intent unknown'}
              </span>
              <span className="mobile-visit-network">
                <NetworkBadge visit={visit} />
              </span>
              <span className="mobile-visit-meta">
                <span>
                  {visit.source === 'server' ? (visit.requestCount ?? 0) : visit.pageCount}{' '}
                  {visit.source === 'server' ? 'requests' : 'page views'} · {visit.eventCount}{' '}
                  events
                </span>
                <time>{date(visit.createdAt)}</time>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
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
            `${v.agentName} ${v.objective} ${v.id} ${v.entryPath} ${v.ip} ${v.network?.ip ?? ''} ${v.network?.location?.country ?? ''} ${v.network?.location?.countryCode ?? ''} ${v.network?.location?.city ?? ''} ${v.network?.asn?.organization ?? ''} ${v.network?.asn?.number ?? ''}`
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
            placeholder="Search an agent, task, IP, city, or network…"
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
          <option value="gateway">Demo website</option>
          <option value="agent">Agent declaration</option>
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
            !data.sessions.length && !data.site.workspace ? (
              <button
                className="button primary"

                disabled={demoBusy}
                onClick={runDemo}
              >
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
            : 'Visit the demo or connect a website to collect your first session.'}
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
    [entryMode, setEntryMode] = useState(site.entryMode ?? 'observe'),
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
          <h1>Check-in questions</h1>
          <p>Choose the context you want agents to share. Answers stay attached to each visit.</p>
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
                entryMode,
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
      <section className="entry-policy">
        <div>
          <h2>At your website’s door</h2>
          <p>
            Ask recognized interactive agents once, then return them to their original destination.
            HTTP fetch tools, search indexers and unknown visitors continue with request logging;
            their intent stays unknown unless they share it.
          </p>
        </div>
        <label>
          Entry behavior
          <select
            value={entryMode}
            onChange={(e) => setEntryMode(e.target.value as 'ask' | 'observe')}
          >
            <option value="ask">Ask agents, then continue</option>
            <option value="observe">Observe without asking</option>
          </select>
        </label>
        <small>
          Requires the server integration. Browser impersonation and service outages are not an
          enforced security boundary.
        </small>
      </section>
      <div className="questions-layout">
        <div>
          <details className="advanced-settings">
            <summary>Advanced demo settings</summary>
            <section className="admission-policy">
              <div>
                <strong>Advanced: require answers on the demo</strong>
                <p>Off by default. Your website embed always stays nonblocking.</p>
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
          </details>
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
            Try optional check-in <ArrowSquareOut size={15} />
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
      <pre tabIndex={0}>{value}</pre>
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
    [serverKind, setServerKind] = useState('express'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const base = site.collectorOrigin ?? window.location.origin;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="section-context">Collection setup</div>
          <h1>Connect your website</h1>
          <p>Save your website, choose your platform, and paste the snippet once.</p>
        </div>
      </div>
      <CustomerSetup site={site} copy={copy} />
      <NetworkSetup />
      <details className="legacy-install">
        <summary>Other platforms and browser-only collection</summary>
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
            <InstallGuide site={site} copy={copy} />

            <details className="panel setup-panel server-setup">
              <summary>
                <Key size={18} /> Add server-side collection <span>For HTTP-only agents</span>
              </summary>
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
                    const data = await api<{ key: string }>('/admin/ingest-key', {
                      method: 'POST',
                    });
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
                Keys are shown once. Rotation immediately invalidates the previous key. Keep this
                key on your server.
              </p>
              <label className="collector-mode">
                Server framework
                <select
                  aria-label="Server framework"
                  value={serverKind}
                  onChange={(e) => setServerKind(e.target.value)}
                >
                  <option value="express">Express</option>
                  <option value="nextjs">Next.js 16+ Proxy</option>
                </select>
              </label>
              <p className="setup-note">
                Save the helper in your app’s lib folder:{' '}
                <a href={serverKind === 'express' ? '/sdk/arrival.ts' : '/sdk/web.ts'} download>
                  {serverKind === 'express' ? 'arrival.ts' : 'web.ts'}
                </a>
                . Keep the ingestion key in a server environment variable.
              </p>
              <CodeBlock
                value={
                  serverKind === 'nextjs'
                    ? `// proxy.ts (alongside app/). Merge with your existing proxy.
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { reportArrival } from './lib/web';

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const incoming = request.cookies.get('arrival_sid')?.value;
  const sessionId = incoming && /^[a-zA-Z0-9_-]{20,120}$/.test(incoming)
    ? incoming : crypto.randomUUID();
  const response = NextResponse.next();
  if (sessionId !== incoming) response.cookies.set('arrival_sid', sessionId, {
    httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
    path: '/', maxAge: 86400,
  });
  response.headers.append('Link', '<${base}/api/agent/manifest/${site.id}>; rel="alternate"; type="application/json"');
  event.waitUntil(reportArrival(request, {
    endpoint: '${base}', key: process.env.ARRIVAL_INGEST_KEY, sessionId,
  }).then(() => {}));
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)'],
};`
                    : `import { arrivalAnalytics } from './lib/arrival';\n\napp.use(arrivalAnalytics({\n  endpoint: '${base}',\n  key: process.env.ARRIVAL_INGEST_KEY,\n  onError: error => console.warn(error.message),\n}));`
                }
                copy={copy}
              />
              <p className="setup-note">
                Use the Express helper without a session package, or download the Web Request helper
                for Next.js. Server reporting is best-effort and never grants or denies website
                access.
              </p>
            </details>
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
                Browse the Northstar demo freely. The small optional check-in connects declared
                purpose to observed activity.
              </p>
              <a className="button primary" href="/lab" target="_blank" rel="noreferrer">
                Open instrumented demo <ArrowSquareOut size={16} />
              </a>
              <hr />
              <strong>HTTP agents are welcome.</strong>
              <p>
                The public manifest explains optional questions and the reporting API. No model key
                or custom agent SDK is needed.
              </p>
              <CodeBlock
                value={`curl -H 'Accept: application/json' \\\n  ${base}/api/agent/manifest/${site.id}`}
                copy={copy}
              />
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
      </details>
    </>
  );
}

function VisitDrawer({
  id,
  initialTab,
  close,
  reload,
  copy,
}: {
  id: string;
  initialTab: string;
  close: () => void;
  reload: () => Promise<Overview>;
  copy: (value: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const animation = useRef<Animation | null>(null),
    closing = useRef(false);
  const dismiss = () => {
    if (closing.current) return;
    if (motionIsInstant() || !dialog.current) {
      close();
      return;
    }
    closing.current = true;
    dialog.current.dataset.closing = 'true';
    const element = dialog.current,
      current = getComputedStyle(element);
    animation.current?.cancel();
    const exit = element.animate(
      [
        { opacity: current.opacity, transform: current.transform },
        { opacity: 0, transform: 'translateX(16px)' },
      ],
      { duration: 140, easing: softEase, fill: 'forwards' },
    );
    animation.current = exit;
    exit.onfinish = close;
  };
  const [detail, setDetail] = useState<{ visit: Visit; events: VisitEvent[] }>();
  const [tab, setTab] = useState(initialTab),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setDetail(await api(`/admin/sessions/${id}`));
  }, [id]);
  useEffect(() => {
    void load().catch((err) => setError(err.message));
    const previousFocus = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    if (element && !motionIsInstant())
      animation.current = element.animate(
        [
          { opacity: 0, transform: 'translateX(20px)' },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        { duration: 240, easing: softEase },
      );
    const interval = setInterval(() => void load().catch(() => {}), 5000);
    return () => {
      clearInterval(interval);
      animation.current?.cancel();
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [load]);
  const visit = detail?.visit;
  const hasAnswers = !!visit && Object.keys(visit.answers).length > 0;
  const fetchOnly = detail?.events.some(
    (event) => event.type === 'entry_observed' && event.data.reason === 'fetch_only',
  );
  const questionsShown = detail?.events.some((event) => event.type === 'entry_presented');
  return (
    <dialog
      className="visit-drawer"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
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
            dismiss();
        }
      }}
      aria-label="Visit details"
    >
      <div className="drawer-shell">
        <header className="drawer-top">
          <span>Visit details</span>
          <button className="icon-button" aria-label="Close visit details" onClick={dismiss}>
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
                <small>{visit.source === 'server' ? 'Requests' : 'Page views'}</small>
                <strong>
                  {visit.source === 'server' ? (visit.requestCount ?? 0) : visit.pageCount}
                </strong>
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
            <div className="drawer-tabs" role="group" aria-label="Visit detail sections">
              {[
                ['answers', 'Task & answers'],
                ['network', 'Network'],
                ['activity', 'Activity'],
                ['signals', 'Signals'],
                ['raw', 'Raw data'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? 'active' : ''}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {key === 'activity' && <span>{detail.events.length}</span>}
                </button>
              ))}
            </div>
            <div
              className="drawer-content"
              key={tab}
              tabIndex={0}
              role="region"
              aria-label="Visit details content"
            >
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
                      <div>
                        <strong>
                          {hasAnswers
                            ? 'No objective supplied'
                            : fetchOnly
                              ? 'Content allowed · intent unknown'
                              : questionsShown
                                ? 'Questions shown · no response received'
                                : 'Intent unknown'}
                        </strong>
                        <p>
                          {hasAnswers
                            ? 'Other submitted answers appear below.'
                            : fetchOnly
                              ? 'Intent unknown. This client was allowed to read without answering. Request and network evidence is available; no task was declared.'
                              : questionsShown
                                ? 'No answers were received. We cannot tell whether the client could answer or chose not to. Its intent is unknown.'
                                : 'No task declaration was received. Request evidence does not reveal the visitor’s purpose.'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="answer-list">
                    {visit.questions.map((q) => (
                      <div key={q.id}>
                        <label>
                          {q.label}
                          <span>
                            {visit.answers[q.id]?.length ? 'Self-reported' : 'No answer received'}
                          </span>
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
                            ? (visit.answers[q.id] as string[]).join(', ') ||
                              (hasAnswers ? 'Not answered' : 'No response received')
                            : visit.answers[q.id] ||
                              (hasAnswers ? 'Not answered' : 'No response received')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="permission-box">
                    <h3>
                      {visit.permissions.length ? 'Demo access permissions' : 'Observation only'}
                    </h3>
                    <div className="permission-list">
                      {visit.permissions.length ? (
                        visit.permissions.map((permission) => (
                          <span key={permission}>
                            <Check size={13} />
                            {permission}
                          </span>
                        ))
                      ) : (
                        <span>Answers do not control website access</span>
                      )}
                    </div>
                    <p>
                      Question version {visit.questionsVersion}
                      {visit.status === 'admitted' ? ` · Expires ${date(visit.expiresAt)}` : ''}
                    </p>
                  </div>
                </>
              )}
              {tab === 'network' && <NetworkDetails visit={visit} copy={copy} />}
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
                            <pre tabIndex={0}>{JSON.stringify(event.data, null, 2)}</pre>
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
                      Headers and browser properties are client-controlled. IP estimates come from
                      local datasets; operator identity remains unverified.
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
                  <pre className="raw-data" tabIndex={0}>
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                </>
              )}
            </div>
            <footer className="drawer-footer">
              <a className="button secondary" href={`/api/admin/export?session=${id}`} download>
                <DownloadSimple size={16} />
                Export visit
              </a>
              {visit.permissions.length > 0 && (
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
                  {visit.status === 'revoked' ? 'Access revoked' : 'Revoke demo access'}
                </button>
              )}
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
