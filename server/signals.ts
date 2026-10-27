import type { Evidence, Visit } from '../src/types.ts';
export function identify(
  userAgent: string,
  ip: string,
  source: 'server observed' | 'integration reported' = 'server observed',
) {
  const evidence: Evidence[] = [
    {
      name: 'User-agent',
      value: userAgent || 'Not provided',
      source: source === 'server observed' ? 'request header' : source,
      note: 'A client-controlled header, not verified identity.',
    },
    {
      name: 'Network address',
      value: ip || 'Not provided',
      source,
      note: 'Connection or integration source; not the end user’s location.',
    },
  ];
  const match = userAgent.match(
    /(Arrival-DemoAgent|GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|PerplexityBot|Perplexity-User|Googlebot|bingbot|Amazonbot|Bytespider|CCBot|python-requests|python-httpx|curl|wget|HeadlessChrome|Playwright|Puppeteer|Selenium|Agent\/[^\s;)]+)/i,
  );
  const automation = /HeadlessChrome|Playwright|Puppeteer|Selenium/i.test(userAgent);
  return {
    evidence,
    agentName: match?.[0] ?? 'Unidentified visitor',
    classification: (automation
      ? 'automation signals'
      : match
        ? 'self-identifying bot'
        : 'unknown') as Visit['classification'],
  };
}
export function cleanPath(input: string) {
  try {
    return new URL(input, 'https://arrival.invalid').pathname.slice(0, 500);
  } catch {
    return '/';
  }
}
export function cleanReferrer(input: string) {
  try {
    const u = new URL(input);
    return ['http:', 'https:'].includes(u.protocol) ? `${u.origin}${u.pathname}`.slice(0, 500) : '';
  } catch {
    return '';
  }
}
export const htmlEscape = (v: unknown) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const jsonScript = (v: unknown) => JSON.stringify(v).replaceAll('<', '\\u003c');
