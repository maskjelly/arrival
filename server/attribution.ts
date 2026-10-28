import type { Visit, VisitAttribution } from '../src/types.ts';
import { providerRanges, type ProviderRanges } from './provider-ranges.ts';

type Client = { name: string; provider: string; role: string; feed?: string; docs?: string };
const openaiDocs = 'https://developers.openai.com/api/docs/bots';
const claudeDocs =
  'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler';
const perplexityDocs = 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers';
export const clients: Client[] = [
  {
    name: 'OAI-SearchBot',
    provider: 'OpenAI',
    role: 'Search indexing',
    feed: 'openai-search',
    docs: openaiDocs,
  },
  {
    name: 'ChatGPT-User',
    provider: 'OpenAI',
    role: 'User-requested retrieval',
    feed: 'openai-user',
    docs: openaiDocs,
  },
  {
    name: 'GPTBot',
    provider: 'OpenAI',
    role: 'Model training crawl',
    feed: 'openai-training',
    docs: openaiDocs,
  },
  {
    name: 'OAI-AdsBot',
    provider: 'OpenAI',
    role: 'Ad review',
    feed: 'openai-ads',
    docs: openaiDocs,
  },
  {
    name: 'Claude-SearchBot',
    provider: 'Anthropic',
    role: 'Search indexing',
    feed: 'anthropic',
    docs: claudeDocs,
  },
  {
    name: 'Claude-User',
    provider: 'Anthropic',
    role: 'User-requested retrieval',
    feed: 'anthropic',
    docs: claudeDocs,
  },
  {
    name: 'ClaudeBot',
    provider: 'Anthropic',
    role: 'Model training crawl',
    feed: 'anthropic',
    docs: claudeDocs,
  },
  {
    name: 'PerplexityBot',
    provider: 'Perplexity',
    role: 'Search indexing',
    feed: 'perplexity-search',
    docs: perplexityDocs,
  },
  {
    name: 'Perplexity-User',
    provider: 'Perplexity',
    role: 'User-requested retrieval',
    feed: 'perplexity-user',
    docs: perplexityDocs,
  },
  {
    name: 'Googlebot',
    provider: 'Google',
    role: 'Search indexing',
    feed: 'google',
    docs: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers',
  },
  {
    name: 'bingbot',
    provider: 'Microsoft',
    role: 'Search indexing',
    feed: 'bing',
    docs: 'https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26',
  },
  {
    name: 'Amazonbot',
    provider: 'Amazon',
    role: 'Web crawling',
    docs: 'https://developer.amazon.com/amazonbot',
  },
  { name: 'Bytespider', provider: 'ByteDance', role: 'Web crawling' },
  { name: 'CCBot', provider: 'Common Crawl', role: 'Web crawling' },
  {
    name: 'AhrefsBot',
    provider: 'Ahrefs',
    role: 'SEO analysis',
    docs: 'https://ahrefs.com/robot/',
  },
  {
    name: 'AhrefsSiteAudit',
    provider: 'Ahrefs',
    role: 'SEO site audit',
    docs: 'https://ahrefs.com/robot/',
  },
];
export function claimedClients(userAgent: string) {
  return clients.filter((client) =>
    new RegExp(`(?:^|[\\s;(])${client.name}(?:[\\s;/)]|$)`, 'i').test(userAgent),
  );
}
const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
function searchSource(url: URL): [string, string] | undefined {
  const host = url.hostname.toLowerCase();
  if (
    /^(www\.)?google\.(com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host) &&
    url.pathname === '/search'
  )
    return ['Google', 'q'];
  if (hostIs(host, 'bing.com') && url.pathname === '/search') return ['Bing', 'q'];
  if (hostIs(host, 'duckduckgo.com')) return ['DuckDuckGo', 'q'];
  if (host === 'search.brave.com' && url.pathname === '/search') return ['Brave Search', 'q'];
  if (host === 'search.yahoo.com' && url.pathname === '/search') return ['Yahoo', 'p'];
  if (hostIs(host, 'baidu.com') && url.pathname === '/s') return ['Baidu', 'wd'];
  if (hostIs(host, 'yandex.com') && url.pathname === '/search/') return ['Yandex', 'text'];
}
export function safeReferrer(input: string) {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const allowed = searchSource(url);
    const query = allowed
      ? url.searchParams
          .get(allowed[1])
          ?.replace(/[\u0000-\u001f\u007f]/g, '')
          .slice(0, 300)
      : '';
    const result = new URL(`${url.origin}${url.pathname}`);
    if (query && allowed) result.searchParams.set(allowed[1], query);
    return result.toString().slice(0, 1500);
  } catch {
    return '';
  }
}
export function referral(input: string, siteOrigin = ''): VisitAttribution['referral'] {
  try {
    const url = new URL(safeReferrer(input));
    const search = searchSource(url);
    const ai = [
      ['chatgpt.com', 'ChatGPT'],
      ['chat.openai.com', 'ChatGPT'],
      ['claude.ai', 'Claude'],
      ['perplexity.ai', 'Perplexity'],
      ['perplexity.com', 'Perplexity'],
      ['copilot.microsoft.com', 'Copilot'],
      ['gemini.google.com', 'Gemini'],
    ].find(([host]) => hostIs(url.hostname, host));
    const internal = siteOrigin && url.origin === new URL(siteOrigin).origin;
    return {
      kind: internal ? 'internal' : search ? 'search' : ai ? 'AI referral' : 'website',
      source: search?.[0] ?? ai?.[1] ?? url.hostname,
      url: url.href,
      searchQuery: search ? (url.searchParams.get(search[1]) ?? undefined) : undefined,
      evidence: 'Supplied referring URL; not proof of the agent’s discovery path.',
    };
  } catch {
    return {
      kind: 'unavailable',
      source: 'No referrer supplied',
      evidence: 'Direct, private and stripped referrals cannot be distinguished.',
    };
  }
}
export function attributeVisit(
  visit: Pick<Visit, 'userAgent' | 'ip' | 'source' | 'isDemo' | 'referrer' | 'environment'>,
  ranges: ProviderRanges = providerRanges,
  siteOrigin = '',
): VisitAttribution {
  const claims = claimedClients(visit.userAgent);
  const client = claims.length === 1 ? claims[0] : undefined;
  const matches = visit.isDemo ? [] : ranges.matches(visit.ip);
  const match = client ? matches.find((item) => item.id === client.feed) : undefined;
  const fresh = match && !match.stale;
  const networkProviders = [
    ...new Set(matches.filter((item) => !item.stale).map((item) => item.provider)),
  ];
  const tool =
    /(?:^|[\s;(])(python-requests|python-httpx|curl|wget|HeadlessChrome|Playwright|Puppeteer|Selenium|Arrival-DemoAgent)(?:[\s;/)]|$)/i.exec(
      visit.userAgent,
    )?.[1];
  return {
    provider:
      client?.provider ??
      (claims.length
        ? 'Conflicting claims'
        : networkProviders.length === 1
          ? networkProviders[0]
          : 'Unidentified'),
    client:
      client?.name ?? tool ?? (claims.length ? 'Conflicting client claims' : 'Unidentified client'),
    role:
      client?.role ??
      (/HeadlessChrome|Playwright|Puppeteer|Selenium/i.test(tool ?? '') ||
      visit.environment.webdriver === true
        ? 'Browser automation'
        : tool
          ? 'HTTP client / script'
          : 'Not established'),
    roleBasis: client
      ? 'Published client role; this does not reveal the visitor’s task.'
      : 'Request or browser signals only.',
    roleDocs: client?.docs,
    confidence: fresh
      ? 'network corroborated'
      : claims.length > 1
        ? 'conflicting claims'
        : client
          ? 'header claim only'
          : networkProviders.length === 1
            ? 'network match only'
            : 'unidentified',
    explanation: visit.isDemo
      ? 'Controlled demo. Provider corroboration is disabled.'
      : fresh
        ? 'The client header and arrival IP agree with the provider’s current published ranges. This is not cryptographic identity or end-user verification.'
        : client
          ? match?.stale
            ? 'Matching cached ranges are stale. The header claim is not corroborated.'
            : 'The client name is claimed in a header. No fresh matching provider range corroborates it; this does not prove impersonation.'
          : networkProviders.length === 1
            ? 'The arrival IP matches a provider range. The client and crawler role are not established.'
            : 'No supported client claim or fresh provider-range match.',
    ipSource: visit.source === 'server' ? 'integration reported' : 'connection observed',
    rangeCheck: client?.feed
      ? {
          status: fresh ? 'matched' : match?.stale ? 'stale' : 'no match',
          source: match?.url ?? ranges.snapshot().find((item) => item.id === client.feed)?.url,
          prefix: match?.prefix,
          checkedAt:
            match?.checkedAt ??
            ranges.snapshot().find((item) => item.id === client.feed)?.checkedAt,
          note: 'Checked against current lists, not historical proof of IP ownership at arrival.',
        }
      : undefined,
    networkProviders,
    referral: referral(visit.referrer, siteOrigin),
  };
}
