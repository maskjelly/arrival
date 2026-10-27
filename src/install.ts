export type Platform = 'html' | 'wix' | 'shopify' | 'nextjs';
export function installSnippet(base: string, siteId: string, mode: string, platform: Platform) {
  const root = new URL(base).origin;
  const id = encodeURIComponent(siteId);
  const checkIn = ['agents', 'all', 'off'].includes(mode) ? mode : 'agents';
  if (platform === 'nextjs')
    return `import Script from 'next/script';

// Add inside your existing app/layout.tsx <html> element.
// Keep your existing layout, metadata and providers.
<head>
  <link rel="alternate" type="application/json"
    title="Optional agent check-in"
    href="${root}/api/agent/manifest/${id}" />
</head>
<body>
  {children}
  <Script id="arrival" strategy="afterInteractive"
    src="${root}/tracker.js"
    data-site="${id}" data-check-in="${checkIn}" />
</body>`;
  return `<link rel="alternate" type="application/json"
  title="Optional agent check-in"
  href="${root}/api/agent/manifest/${id}">
<script defer src="${root}/tracker.js"
  data-site="${id}" data-check-in="${checkIn}"></script>`;
}
