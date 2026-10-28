export function isReadOnlyFetch(userAgent: string): boolean;
export function classify(userAgent: string): 'agent' | 'indexer' | 'unknown';
export function seal(value: Record<string, unknown>, secret: string): Promise<string>;
export function unseal(
  token: string | null | undefined,
  secret: string,
  purpose: string,
  siteId: string,
  origin: string,
): Promise<Record<string, any> | undefined>;
export function handleArrival(
  request: Request,
  configuration: { endpoint: string; siteId: string; key: string; clientIp?: string },
  event?: { waitUntil: (work: Promise<any>) => void },
): Promise<{ response?: Response; headers?: Record<string, string>; cookies?: string[] }>;
