import ipaddr from 'ipaddr.js';
import type { Request } from 'express';
import type { NetworkContext, NetworkLookup } from '../src/types.ts';

export const requestHeaderNames = [
  'accept',
  'accept-language',
  'accept-encoding',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'dnt',
  'sec-gpc',
  'purpose',
  'sec-purpose',
] as const;

export function addressInfo(value: string) {
  try {
    const address = ipaddr.process(value.trim().split('%')[0]);
    const range = address.range();
    return {
      ip: address.toString(),
      version: address.kind() === 'ipv4' ? (4 as const) : (6 as const),
      scope: range === 'unicast' ? 'public' : range,
    };
  } catch {
    return { ip: '', version: null, scope: 'unknown' };
  }
}
export function safeHeaders(headers: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const name of requestHeaderNames) {
    const value = headers[name];
    if (typeof value === 'string')
      result[name] = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 700);
  }
  return result;
}
export function hostingHint(organization: string) {
  const patterns: [RegExp, string][] = [
    [/amazon|\baws\b/i, 'Amazon network'],
    [/google/i, 'Google network'],
    [/microsoft|azure/i, 'Microsoft network'],
    [/cloudflare/i, 'Cloudflare network'],
    [/digitalocean/i, 'DigitalOcean'],
    [/hetzner/i, 'Hetzner'],
    [/ovh/i, 'OVHcloud'],
    [/akamai|linode/i, 'Akamai / Linode'],
    [/vultr|choopa/i, 'Vultr'],
    [/oracle/i, 'Oracle network'],
    [/alibaba|aliyun/i, 'Alibaba network'],
    [/tencent/i, 'Tencent network'],
    [/fastly/i, 'Fastly'],
    [/leaseweb/i, 'Leaseweb'],
    [/scaleway|online s\.a\.s/i, 'Scaleway'],
    [/contabo/i, 'Contabo'],
  ];
  const match = patterns.find(([pattern]) => pattern.test(organization));
  return match
    ? {
        provider: match[1],
        kind: 'cloud / hosting / CDN' as const,
        confidence: 'inferred' as const,
      }
    : undefined;
}

export type LookupNetwork = (ip: string) => NetworkLookup;
export function captureNetwork(req: Request, lookup: LookupNetwork): NetworkContext {
  const address = addressInfo(req.ip ?? req.socket.remoteAddress ?? '');
  return {
    ...address,
    peerIp: addressInfo(req.socket.remoteAddress ?? '').ip,
    ipSource: req.ips.length ? 'trusted proxy' : 'direct connection',
    observedAt: new Date().toISOString(),
    request: {
      method: req.method,
      httpVersion: req.httpVersion,
      scheme: req.protocol,
      headers: safeHeaders(req.headers),
    },
    ...lookup(address.ip),
  };
}
export function reportedNetwork(
  ip: string,
  lookup: LookupNetwork,
  request: NetworkContext['request'] = {},
  legacy = false,
): NetworkContext {
  const address = addressInfo(ip);
  return {
    ...address,
    ipSource: legacy ? 'stored address' : 'integration reported',
    observedAt: new Date().toISOString(),
    request: { ...request, headers: safeHeaders(request.headers ?? {}) },
    ...lookup(address.ip),
  };
}
