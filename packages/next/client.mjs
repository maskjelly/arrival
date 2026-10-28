import React from 'react';
import Script from 'next/script';
export function Arrival() {
  const endpoint = process.env.NEXT_PUBLIC_ARRIVAL_URL,
    siteId = process.env.NEXT_PUBLIC_ARRIVAL_SITE_ID;
  if (!endpoint || !siteId) return null;
  return React.createElement(Script, {
    id: 'arrival',
    src: endpoint.replace(/\/$/, '') + '/tracker.js',
    'data-site': siteId,
    'data-check-in': 'off',
    'data-entry': 'ask',
    strategy: 'beforeInteractive',
  });
}
