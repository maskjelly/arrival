import { useState } from 'react';
import type { Site } from './types.ts';
export const sdkUrl =
  'https://github.com/maskjelly/arrival/releases/download/sdk-v0.2.3/arrival-next-0.2.3.tgz';
export const middlewareCode = `export { middleware } from '@arrival/next';
export const config = {
  matcher: ['/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\\\.(?:css|js|png|jpg|jpeg|gif|svg|woff2?)$).*)'],
};`;
export function CustomerSetup({
  site,
  initialKey = '',
  copy,
}: {
  site: Site;
  initialKey?: string;
  copy: (value: string) => void;
}) {
  const [key, setKey] = useState(initialKey),
    [error, setError] = useState('');
  const endpoint = site.collectorOrigin ?? location.origin;
  return (
    <section className="customer-setup">
      <div className="setup-intro">
        <span className="setup-status">Next.js integration</span>
        <h2>One install. A warmer welcome.</h2>
        <p>
          The same package handles agent introductions, request tracking and browser signals. Your
          questions stay managed here.
        </p>
      </div>
      <ol className="install-steps">
        <li>
          <div>
            <h3>Install Arrival</h3>
            <p>Run this in your website project.</p>
          </div>
          <Snippet value={`npm install ${sdkUrl}`} copy={copy} />
        </li>
        <li>
          <div>
            <h3>Set your environment</h3>
            <p>
              Use these in your hosting provider’s environment settings. Keep the private key on the
              server.
            </p>
          </div>
          {!key && (
            <button
              className="button secondary"
              onClick={async () => {
                setError('');
                try {
                  const r = await fetch('/api/admin/ingest-key', { method: 'POST' });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setKey(d.key);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {site.hasIngestKey ? 'Replace integration key' : 'Create integration key'}
            </button>
          )}
          {site.hasIngestKey && !key && (
            <p className="setup-note">
              Replacing the key disconnects the previous install until its environment is updated.
            </p>
          )}
          <Snippet
            value={`NEXT_PUBLIC_ARRIVAL_URL=${endpoint}\nNEXT_PUBLIC_ARRIVAL_SITE_ID=${site.id}\nARRIVAL_INGEST_KEY=${key || 'YOUR_PRIVATE_KEY'}`}
            copy={copy}
          />
        </li>
        <li>
          <div>
            <h3>Add the entry layer</h3>
            <p>
              Create <code>middleware.ts</code> in your project root. If you already have
              middleware, compose Arrival before returning its response.
            </p>
          </div>
          <Snippet value={middlewareCode} copy={copy} />
        </li>
        <li>
          <div>
            <h3>Include browser observations</h3>
            <p>
              In your root layout, import Arrival and add it inside your existing body. Keep your
              layout and providers.
            </p>
          </div>
          <Snippet
            value={`import { Arrival } from '@arrival/next/client';\n\n// Inside your existing <body>:\n<Arrival />`}
            copy={copy}
          />
        </li>
      </ol>
      <div className="setup-outcome">
        <strong>Deploy once. Manage questions here.</strong>
        <p>
          Recognized interactive agents meet your questions at the page they requested. A valid
          introduction resumes their destination. HTTP fetch tools, human-looking clients and search
          indexers are observed without required answers. Their intent remains unknown unless
          declared. No detection method identifies every bot.
        </p>
        <p>
          Browser-only installs on Wix and Shopify collect signals and show a prompt. They cannot
          enforce an HTTP entry layer. Native platform apps are not shipped.
        </p>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function Snippet({ value, copy }: { value: string; copy: (value: string) => void }) {
  return (
    <div className="setup-snippet">
      <button onClick={() => copy(value)} aria-label="Copy installation code">
        Copy
      </button>
      <pre tabIndex={0}>{value}</pre>
    </div>
  );
}
