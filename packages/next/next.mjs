import { NextResponse } from 'next/server';
import { handleArrival } from './core.mjs';
export async function middleware(request, event) {
  // Vercel overwrites this header at its edge. Other hosts must supply a trusted IP adapter.
  const clientIp =
    process.env.VERCEL === '1'
      ? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      : undefined;
  const result = await handleArrival(
    request,
    {
      endpoint: process.env.NEXT_PUBLIC_ARRIVAL_URL,
      siteId: process.env.NEXT_PUBLIC_ARRIVAL_SITE_ID,
      key: process.env.ARRIVAL_INGEST_KEY,
      clientIp,
    },
    event,
  );
  if (result.response) return result.response;
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(result.headers ?? {})) response.headers.set(key, value);
  for (const cookie of result.cookies ?? []) {
    const [pair, ...attributes] = cookie.split(';').map((v) => v.trim());
    const split = pair.indexOf('=');
    response.cookies.set(pair.slice(0, split), pair.slice(split + 1), {
      path: '/',
      httpOnly: attributes.includes('HttpOnly'),
      secure: attributes.includes('Secure'),
      sameSite: 'lax',
      maxAge: 3600,
    });
  }
  return response;
}
