import { open, type Reader, type CityResponse, type AsnResponse } from 'maxmind';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { addressInfo, hostingHint } from './network.ts';
import type { NetworkLookup } from '../src/types.ts';

export const geoAttribution = {
  name: 'DB-IP Lite',
  url: 'https://db-ip.com',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
};
export class NetworkEnricher {
  private city?: Reader<CityResponse>;
  private asn?: Reader<AsnResponse>;
  private cache = new Map<string, NetworkLookup>();
  private job?: Promise<void>;
  private progress: {
    running: boolean;
    stage: string;
    downloadedBytes?: number;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  } = { running: false, stage: 'idle' };
  private loadErrors: string[] = [];
  readonly readOnly: boolean;
  readonly cityPath: string;
  readonly asnPath: string;
  constructor(options: { cityPath?: string; asnPath?: string; readOnly?: boolean } = {}) {
    this.readOnly = !!options.readOnly;
    this.cityPath = options.cityPath ?? resolve('.data/geo/city.mmdb');
    this.asnPath = options.asnPath ?? resolve('.data/geo/asn.mmdb');
  }
  async load() {
    this.loadErrors = [];
    const readers = await Promise.allSettled([
      open<CityResponse>(this.cityPath),
      open<AsnResponse>(this.asnPath),
    ]);
    const city = readers[0],
      asn = readers[1];
    if (city.status === 'fulfilled' && /^DBIP-.*city/i.test(city.value.metadata.databaseType))
      this.city = city.value;
    else this.loadErrors.push('City database is unavailable.');
    if (asn.status === 'fulfilled' && /^DBIP-.*asn/i.test(asn.value.metadata.databaseType))
      this.asn = asn.value;
    else this.loadErrors.push('ASN database is unavailable.');
    this.cache.clear();
  }
  status() {
    const database = (reader?: Reader<CityResponse> | Reader<AsnResponse>) =>
      reader
        ? {
            available: true,
            type: reader.metadata.databaseType,
            builtAt: reader.metadata.buildEpoch.toISOString(),
            stale: Date.now() - reader.metadata.buildEpoch.getTime() > 45 * 86400000,
          }
        : { available: false };
    return {
      enabled: !!(this.city || this.asn),
      updatesManaged: this.readOnly,
      provider: geoAttribution,
      city: database(this.city),
      asn: database(this.asn),
      job: { ...this.progress },
      errors: [...this.loadErrors],
    };
  }
  lookup = (ip: string): NetworkLookup => {
    const address = addressInfo(ip);
    if (address.scope !== 'public') return { enrichment: { status: 'non-public address' } };
    const cached = this.cache.get(address.ip);
    if (cached) return cached;
    try {
      const city = this.city?.get(address.ip);
      const pair = this.asn?.getWithPrefixLength(address.ip);
      const asn = pair?.[0];
      const matched = !!city || !!asn;
      const result: NetworkLookup = {
        enrichment: {
          status: matched ? 'enriched' : this.city || this.asn ? 'no match' : 'not installed',
          ...(this.city || this.asn
            ? {
                source: 'DB-IP Lite',
                cityBuiltAt: this.city?.metadata.buildEpoch.toISOString(),
                asnBuiltAt: this.asn?.metadata.buildEpoch.toISOString(),
                lookedUpAt: new Date().toISOString(),
              }
            : {}),
        },
        ...(city
          ? {
              location: {
                countryCode: city.country?.iso_code,
                country: city.country?.names?.en,
                continent: city.continent?.names?.en,
                region: city.subdivisions?.[0]?.names?.en,
                city: city.city?.names?.en,
                latitude:
                  typeof city.location?.latitude === 'number'
                    ? Math.round(city.location.latitude * 100) / 100
                    : undefined,
                longitude:
                  typeof city.location?.longitude === 'number'
                    ? Math.round(city.location.longitude * 100) / 100
                    : undefined,
                approximate: true,
              },
            }
          : {}),
        ...(asn
          ? {
              asn: {
                number: asn.autonomous_system_number,
                organization: asn.autonomous_system_organization,
                prefixLength: pair![1] > 32 && address.version === 4 ? pair![1] - 96 : pair![1],
              },
              hosting: hostingHint(asn.autonomous_system_organization),
            }
          : {}),
      };
      if (this.cache.size >= 10000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(address.ip, result);
      return result;
    } catch {
      return { enrichment: { status: 'lookup failed' } };
    }
  };
  update(month = new Date().toISOString().slice(0, 7)) {
    if (this.readOnly)
      return Promise.reject(new Error('IP datasets are managed by the deployment build.'));
    if (this.job) return this.job;
    this.progress = { running: true, stage: 'starting', startedAt: new Date().toISOString() };
    this.job = this.install(month)
      .then(() => {
        this.progress = {
          ...this.progress,
          running: false,
          stage: 'ready',
          completedAt: new Date().toISOString(),
        };
      })
      .catch(() => {
        this.progress = {
          ...this.progress,
          running: false,
          stage: 'failed',
          error:
            'Database update failed. Existing data remains active. Check server connectivity or run npm run geo:update.',
        };
      })
      .finally(() => {
        this.job = undefined;
      });
    return this.job;
  }
  private async install(month: string) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use YYYY-MM.');
    for (const [kind, path] of [
      ['city', this.cityPath],
      ['asn', this.asnPath],
    ] as const) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temp = `${path}.download`;
      this.progress = {
        ...this.progress,
        stage: `Downloading ${kind} database`,
        downloadedBytes: 0,
      };
      try {
        const response = await fetch(
          `https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz`,
          { signal: AbortSignal.timeout(180000) },
        );
        if (!response.ok || !response.body) throw new Error('Download failed.');
        let bytes = 0,
          expanded = 0;
        await pipeline(
          Readable.fromWeb(response.body as never),
          new Transform({
            transform: (chunk, _encoding, done) => {
              bytes += chunk.length;
              this.progress.downloadedBytes = bytes;
              done(bytes > 256 * 1024 * 1024 ? new Error('Download too large.') : null, chunk);
            },
          }),
          createGunzip(),
          new Transform({
            transform(chunk, _encoding, done) {
              expanded += chunk.length;
              done(expanded > 512 * 1024 * 1024 ? new Error('Database too large.') : null, chunk);
            },
          }),
          createWriteStream(temp, { mode: 0o600 }),
        );
        const reader = await open<CityResponse | AsnResponse>(temp);
        if (!new RegExp(`^DBIP-.*${kind}`, 'i').test(reader.metadata.databaseType))
          throw new Error('Wrong database type.');
        await rename(temp, path);
      } finally {
        await rm(temp, { force: true });
      }
    }
    await writeFile(
      resolve(dirname(this.cityPath), 'ATTRIBUTION.txt'),
      'IP geolocation and ASN data by DB-IP (https://db-ip.com). DB-IP Lite is licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n',
      { mode: 0o600 },
    );
    await this.load();
  }
}
export type NetworkServiceStatus = ReturnType<NetworkEnricher['status']>;
