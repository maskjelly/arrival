import ipaddr from 'ipaddr.js';
import feeds from './provider-feeds.json' with { type: 'json' };
import bundled from './data/provider-ranges.json' with { type: 'json' };

export type RangeFeed = {
  id: string;
  provider: string;
  url: string;
  checkedAt: string;
  prefixes: string[];
};
export const rangeFreshnessMs = 7 * 86400000;
export function parsePrefixes(value: unknown): string[] {
  const rows = (value as { prefixes?: unknown })?.prefixes;
  if (!Array.isArray(rows) || !rows.length || rows.length > 20000)
    throw new Error('Invalid range feed');
  return rows.map((row) => {
    const prefix = row?.ipv4Prefix ?? row?.ipv6Prefix;
    if (typeof prefix !== 'string') throw new Error('Invalid prefix');
    const [address, bits] = ipaddr.parseCIDR(prefix);
    // Providers do not legitimately publish the entire internet as a crawler range.
    if (bits < (address.kind() === 'ipv4' ? 8 : 16)) throw new Error('Overbroad prefix');
    return prefix;
  });
}
export class ProviderRanges {
  private feeds: RangeFeed[];
  private pending?: Promise<void>;
  private compiled = new WeakMap<
    RangeFeed,
    { prefix: string; range: ReturnType<typeof ipaddr.parseCIDR> }[]
  >();
  private nextRefresh = 0;
  constructor(initial: RangeFeed[] = bundled) {
    this.feeds = initial;
  }
  snapshot() {
    return this.feeds;
  }
  // Refresh only on owner reads, never on the visitor's content/collection path.
  async refresh(fetcher: typeof fetch = fetch) {
    if (this.pending) return this.pending;
    if (Date.now() < this.nextRefresh) return;
    this.nextRefresh = Date.now() + 6 * 3600000;
    this.pending = (async () => {
      await Promise.allSettled(
        feeds.map(async (feed) => {
          const response = await fetcher(feed.url, {
            signal: AbortSignal.timeout(3500),
            redirect: 'error',
          });
          if (!response.ok) throw new Error('Feed unavailable');
          const body = await response.text();
          if (body.length > 2_000_000) throw new Error('Feed too large');
          const prefixes = parsePrefixes(JSON.parse(body));
          const updated = { ...feed, prefixes, checkedAt: new Date().toISOString() };
          this.feeds = [...this.feeds.filter((item) => item.id !== feed.id), updated];
        }),
      );
    })().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  matches(ip: string) {
    try {
      const address = ipaddr.process(ip);
      if (address.range() !== 'unicast') return [];
      return this.feeds.flatMap((feed) => {
        let ranges = this.compiled.get(feed);
        if (!ranges) {
          ranges = feed.prefixes.flatMap((prefix) => {
            try {
              return [{ prefix, range: ipaddr.parseCIDR(prefix) }];
            } catch {
              return [];
            }
          });
          this.compiled.set(feed, ranges);
        }
        const prefix = ranges.find(
          ({ range }) => address.kind() === range[0].kind() && address.match(range),
        )?.prefix;
        return prefix
          ? [
              {
                ...feed,
                prefixes: undefined,
                prefix,
                stale:
                  !Number.isFinite(Date.parse(feed.checkedAt)) ||
                  Date.now() - Date.parse(feed.checkedAt) > rangeFreshnessMs ||
                  Date.parse(feed.checkedAt) > Date.now() + 60000,
              },
            ]
          : [];
      });
    } catch {
      return [];
    }
  }
}
export const providerRanges = new ProviderRanges();
