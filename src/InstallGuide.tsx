import { useState } from 'react';
import { CheckCircle, Copy, ArrowClockwise } from '@phosphor-icons/react';
import type { Site } from './types.ts';
import { installSnippet, type Platform } from './install.ts';

const platforms: { id: Platform; name: string; steps: string[] }[] = [
  {
    id: 'html',
    name: 'Any website',
    steps: [
      'Paste this once in your shared HTML head or site-wide custom code.',
      'Publish, open your website, then check the installation below. Client-side navigation is tracked automatically.',
    ],
  },
  {
    id: 'wix',
    name: 'Wix',
    steps: [
      'In your published site’s dashboard, open Settings → Custom Code → Add Custom Code.',
      'Paste this snippet. Choose Head, All pages, and load once per visit. Use your site’s analytics consent category.',
      'Apply and visit your published domain. Use Custom Code, rather than an HTML iframe element. A connected domain and a plan supporting custom code are needed.',
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    steps: [
      'In Online Store → Themes, duplicate your theme, then open Edit code on the copy.',
      'Open layout/theme.liquid and paste this before </head>. Preview and publish the theme.',
      'This covers the theme storefront. Checkout, customer accounts and headless storefronts have separate integration surfaces. This is a snippet install, not a Shopify app.',
    ],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    steps: [
      'Add the link and Script to your existing App Router root layout. Keep one head, one body, and your existing providers.',
      'For the Pages Router, put Script in pages/_app.tsx and the link in next/head.',
      'Deploy and visit your website. Route changes are captured without adding a tracking call to every page.',
    ],
  },
];
export default function InstallGuide({
  site,
  copy,
}: {
  site: Site;
  copy: (value: string) => void;
}) {
  const [platform, setPlatform] = useState<Platform>('html');
  const [mode, setMode] = useState('agents');
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  const base = site.collectorOrigin ?? location.origin;
  const snippet = installSnippet(base, site.id, mode, platform);
  const current = platforms.find((p) => p.id === platform)!;
  return (
    <section className="panel setup-panel install-guide">
      {['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname) && (
        <div className="inline-note">
          <p>
            This collector address is local. For a live website, host Arrival on HTTPS and set
            PUBLIC_URL to that address before copying the snippet.
          </p>
        </div>
      )}
      <div className="setup-heading">
        <CheckCircle size={24} />
        <div>
          <h2>Paste once. Keep browsing.</h2>
          <p>Page views and optional answers. No redirects, blockers, or private key.</p>
        </div>
      </div>
      <div className="install-platforms" role="tablist" aria-label="Website platform">
        {platforms.map((p) => (
          <button
            key={p.id}
            id={`platform-${p.id}`}
            role="tab"
            tabIndex={platform === p.id ? 0 : -1}
            aria-controls="install-platform-panel"
            aria-selected={platform === p.id}
            className={platform === p.id ? 'selected' : ''}
            onClick={() => setPlatform(p.id)}
            onKeyDown={(event) => {
              const index = platforms.findIndex((item) => item.id === p.id);
              let next = index;
              if (event.key === 'ArrowRight') next = (index + 1) % platforms.length;
              else if (event.key === 'ArrowLeft')
                next = (index + platforms.length - 1) % platforms.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = platforms.length - 1;
              else return;
              event.preventDefault();
              setPlatform(platforms[next].id);
              document.getElementById(`platform-${platforms[next].id}`)?.focus();
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div id="install-platform-panel" role="tabpanel" aria-labelledby={`platform-${platform}`}>
        <ol className="install-steps">
          {current.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <label className="collector-mode">
          Optional check-in
          <select
            aria-label="Browser check-in mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="agents">Small prompt for suspected agents</option>
            <option value="all">Small prompt for everyone</option>
            <option value="off">Collect activity only</option>
          </select>
        </label>
        <div className="code-block">
          <button
            className="icon-button"
            aria-label="Copy installation snippet"
            onClick={() => copy(snippet)}
          >
            <Copy size={17} />
          </button>
          <pre tabIndex={0}>{snippet}</pre>
        </div>
      </div>
      <p className="setup-note">
        The prompt is collapsed and never takes focus. Visitors can skip it. Input values, page text
        and URL queries are not collected. Load the script through your existing consent setup when
        needed.
      </p>
      <div className="install-verification">
        <button
          className="button secondary"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            try {
              const response = await fetch('/api/admin/installation');
              if (!response.ok) throw new Error('Sign in again to check installation.');
              const data = await response.json();
              setStatus(
                data.browser.lastSeen
                  ? `Browser collector received a visit from ${site.origin} at ${new Date(data.browser.lastSeen).toLocaleString()}.`
                  : `No browser data from ${site.origin} yet. Save the exact origin above, publish the snippet, then visit the website. Check consent settings, content blockers and script/connect CSP rules.`,
              );
            } catch (err) {
              setStatus((err as Error).message);
            } finally {
              setChecking(false);
            }
          }}
        >
          <ArrowClockwise size={16} />
          {checking ? 'Checking…' : 'Check installation'}
        </button>
        {status && <p role="status">{status}</p>}
      </div>
      <div className="inline-note">
        <p>
          <strong>HTTP agents:</strong> the included link exposes the optional questions to clients
          that do not run JavaScript. Automatic logging of their requests also needs server
          collection or CDN logs. A script cannot observe requests when it never runs.
        </p>
      </div>
    </section>
  );
}
