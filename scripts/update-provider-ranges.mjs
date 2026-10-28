import { readFile, writeFile } from 'node:fs/promises';
import ipaddr from 'ipaddr.js';
const feeds = JSON.parse(
  await readFile(new URL('../server/provider-feeds.json', import.meta.url), 'utf8'),
);
const data = await Promise.all(
  feeds.map(async (feed) => {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`${feed.id}: HTTP ${response.status}`);
    const body = await response.json();
    const prefixes = body.prefixes.map((row) => row.ipv4Prefix ?? row.ipv6Prefix);
    if (!prefixes.length || prefixes.length > 20000) throw new Error('Invalid feed');
    for (const prefix of prefixes) {
      const [address, bits] = ipaddr.parseCIDR(prefix);
      if (bits < (address.kind() === 'ipv4' ? 8 : 16)) throw new Error('Overbroad prefix');
    }
    return { ...feed, checkedAt: new Date().toISOString(), prefixes };
  }),
);
await writeFile(
  new URL('../server/data/provider-ranges.json', import.meta.url),
  JSON.stringify(data, null, 2) + '\n',
);
console.log(data.map((feed) => `${feed.id}: ${feed.prefixes.length} ranges`).join('\n'));
