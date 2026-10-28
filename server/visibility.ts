import { attributeVisit } from './attribution.ts';
import type {
  TrafficType,
  Visit,
  VisitVisibility,
  VisibilityReport,
  VisibilityRecord,
  VisibilityFilters,
} from '../src/types.ts';
import type { Store } from './store.ts';

export function visitVisibility(
  visit: Pick<Visit, 'attribution' | 'answers' | 'objective' | 'entryPath' | 'journey'>,
): VisitVisibility {
  const a = visit.attribution;
  const kind = a?.trafficType ?? 'unidentified';
  const declaredSource = typeof visit.answers.discovery === 'string' ? visit.answers.discovery : '';
  const query = a?.referral.searchQuery;
  const paths = [
    ...new Set(
      [
        visit.entryPath,
        ...(visit.journey?.steps.map((s) => s.path) ?? []),
        visit.journey?.lastPath,
      ].filter((p): p is string => !!p),
    ),
  ];
  const tags: string[] = [];
  if (kind === 'crawler') tags.push(a?.role ?? 'Web crawling');
  if (kind === 'agent')
    tags.push(
      a?.role === 'User-requested retrieval' ? 'User-requested fetch' : 'Agent declaration',
    );
  if (kind === 'automation') tags.push(a?.role ?? 'Automation signals');
  if (paths.includes('/robots.txt')) tags.push('Robots rules requested');
  if (paths.some((p) => /\/[^/]*sitemap[^/]*\.xml$/i.test(p))) tags.push('Sitemap requested');
  if (paths.some((p) => /^\/(docs?|documentation|api)(\/|$)/i.test(p)))
    tags.push('Documentation visited');
  if (paths.some((p) => /^\/(pricing|plans)(\/|$)/i.test(p))) tags.push('Pricing visited');
  if (paths.some((p) => /^\/(\.git|\.env)(\/|$)|\/(phpinfo|info)\.php$/i.test(p)))
    tags.push('Configuration paths requested');
  const reason =
    visit.objective ||
    (kind === 'crawler'
      ? (a?.role ?? 'Web crawling')
      : kind === 'agent' && a?.role === 'User-requested retrieval'
        ? 'Retrieving a page for a user'
        : kind === 'automation'
          ? 'Automated activity observed'
          : 'Purpose not established');
  return {
    kind,
    kindBasis: a?.trafficTypeBasis ?? 'No supported client or automation evidence.',
    role: a?.role ?? '',
    source: a?.referral.source ?? 'No referrer supplied',
    sourceKind: a?.referral.kind ?? 'unavailable',
    query,
    queryState: query ? 'supplied' : 'not supplied',
    declaredSource,
    reason,
    reasonBasis: visit.objective
      ? 'declared'
      : kind === 'crawler' || (kind === 'agent' && a?.role === 'User-requested retrieval')
        ? 'published role'
        : 'not established',
    entryPath: visit.entryPath,
    lastPath: visit.journey?.lastPath ?? visit.entryPath,
    paths,
    tags,
  };
}
export async function visibilityReport(
  store: Store,
  since: string,
  filters: VisibilityFilters = {},
  pageSize = 50,
): Promise<VisibilityReport> {
  const site = await store.site();
  // One scoped read, rather than querying each visit. The explicit ceiling is shown in the UI.
  const rows = await store.db
    .prepare(
      `SELECT s.id,s.created_at,s.user_agent,s.ip,s.referrer,s.entry_path,s.source,s.is_demo,s.answers,s.environment,
    (SELECT COUNT(*) FROM events e WHERE e.session_id=s.id AND e.type IN ('request','page_view')) AS requests,
    (SELECT path FROM events e WHERE e.session_id=s.id AND e.type IN ('request','page_view','click') ORDER BY created_at DESC,rowid DESC LIMIT 1) AS last_path,
    (SELECT json_group_array(path) FROM (SELECT DISTINCT path FROM events e WHERE e.session_id=s.id AND e.type IN ('request','page_view') LIMIT 100)) AS paths
    FROM sessions s WHERE s.site_id=? AND s.created_at>=? ORDER BY s.created_at DESC,s.id DESC LIMIT 5001`,
    )
    .all(store.siteId, since);
  const capped = rows.length > 5000;
  const records: VisibilityRecord[] = rows.slice(0, 5000).map((row) => {
    const answers = JSON.parse(String(row.answers));
    const v = {
      source: String(row.source) as Visit['source'],
      userAgent: String(row.user_agent),
      ip: String(row.ip),
      referrer: String(row.referrer),
      environment: JSON.parse(String(row.environment)),
      isDemo: !!row.is_demo || /^Arrival-DemoAgent\//i.test(String(row.user_agent)),
      answers,
      objective: typeof answers.objective === 'string' ? answers.objective : '',
      entryPath: String(row.entry_path),
    };
    const attribution = attributeVisit(v, undefined, site.origin);
    const paths = JSON.parse(String(row.paths || '[]')) as string[];
    const context = visitVisibility({
      ...v,
      attribution,
      journey: {
        steps: paths.map((path) => ({ path, type: 'request', at: '', source: 'recorded' })),
        total: Number(row.requests),
        lastPath: String(row.last_path ?? row.entry_path),
      },
    });
    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      client: attribution.client,
      provider: attribution.provider,
      confidence: attribution.confidence,
      isDemo: v.isDemo,
      requests: Number(row.requests),
      ...context,
    };
  });
  const eligible = records.filter((r) => filters.includeDemo || !r.isDemo);
  const filtered = eligible.filter(
    (r) =>
      (!filters.kind || r.kind === filters.kind) &&
      (!filters.provider || r.provider === filters.provider) &&
      (!filters.client || r.client === filters.client) &&
      (!filters.source || r.source === filters.source) &&
      (!filters.query || r.query === filters.query) &&
      (!filters.page || r.paths.includes(filters.page)) &&
      (!filters.search ||
        [r.client, r.provider, r.source, r.query, r.declaredSource, r.reason, ...r.paths, ...r.tags]
          .join(' ')
          .toLowerCase()
          .includes(filters.search.toLowerCase())),
  );
  const providerOptions = [...new Set(eligible.map((r) => r.provider))].sort();
  const totals = {
    visits: filtered.length,
    crawlers: 0,
    agents: 0,
    automation: 0,
    unidentified: 0,
    withSource: 0,
    withQuery: 0,
    withDeclaration: 0,
    requests: 0,
  };
  const providers = new Map<
    string,
    {
      provider: string;
      client: string;
      kind: TrafficType;
      role: string;
      visits: number;
      requests: number;
      pages: Set<string>;
      latest: string;
    }
  >();
  const queries = new Map<
    string,
    {
      query: string;
      source: string;
      kind: TrafficType;
      page: string;
      visits: number;
      providers: Set<string>;
    }
  >();
  const pages = new Map<
    string,
    {
      path: string;
      visits: number;
      crawlers: number;
      agents: number;
      providers: Set<string>;
      queries: Set<string>;
      latest: string;
    }
  >();
  const sources = new Map<
    string,
    { source: string; kind: string; visits: number; queries: number }
  >();
  for (const r of filtered) {
    if (r.kind === 'crawler') totals.crawlers++;
    else if (r.kind === 'agent') totals.agents++;
    else if (r.kind === 'automation') totals.automation++;
    else totals.unidentified++;
    if (r.sourceKind !== 'unavailable') totals.withSource++;
    if (r.query) totals.withQuery++;
    if (r.reasonBasis === 'declared') totals.withDeclaration++;
    totals.requests += r.requests;
    const key = JSON.stringify([r.provider, r.client, r.kind]);
    const provider = providers.get(key) ?? {
      provider: r.provider,
      client: r.client,
      kind: r.kind,
      role: r.role || r.kindBasis,
      visits: 0,
      requests: 0,
      pages: new Set<string>(),
      latest: r.createdAt,
    };
    provider.visits++;
    provider.requests += r.requests;
    for (const path of r.paths) provider.pages.add(path);
    providers.set(key, provider);
    const source = sources.get(r.source) ?? {
      source: r.source,
      kind: r.sourceKind,
      visits: 0,
      queries: 0,
    };
    source.visits++;
    if (r.query) source.queries++;
    sources.set(r.source, source);
    if (r.query) {
      const key = JSON.stringify([r.query, r.source, r.kind, r.entryPath]);
      const query = queries.get(key) ?? {
        query: r.query,
        source: r.source,
        kind: r.kind,
        page: r.entryPath,
        visits: 0,
        providers: new Set<string>(),
      };
      query.visits++;
      query.providers.add(r.provider);
      queries.set(key, query);
    }
    for (const path of r.paths) {
      const page = pages.get(path) ?? {
        path,
        visits: 0,
        crawlers: 0,
        agents: 0,
        providers: new Set<string>(),
        queries: new Set<string>(),
        latest: r.createdAt,
      };
      page.visits++;
      if (r.kind === 'crawler') page.crawlers++;
      if (r.kind === 'agent') page.agents++;
      page.providers.add(r.provider);
      if (r.query && path === r.entryPath) page.queries.add(r.query);
      pages.set(path, page);
    }
  }
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  return {
    scope: {
      since,
      scanned: records.length,
      capped,
      limit: 5000,
      excludedDemos: records.filter((r) => r.isDemo).length,
      includeDemo: !!filters.includeDemo,
    },
    totals,
    providerOptions,
    providers: [...providers.values()]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 50)
      .map((p) => ({ ...p, pages: p.pages.size })),
    queries: [...queries.values()]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 100)
      .map((q) => ({ ...q, providers: [...q.providers] })),
    pages: [...pages.values()]
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 100)
      .map((p) => ({ ...p, providers: [...p.providers], queries: [...p.queries] })),
    sources: [...sources.values()].sort((a, b) => b.visits - a.visits).slice(0, 50),
    records: filtered.slice(offset, offset + pageSize),
    offset,
    hasMore: offset + pageSize < filtered.length,
  };
}
