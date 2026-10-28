import { useState } from 'react';
import type { Site } from './types.ts';
import { CustomerSetup } from './CustomerSetup.tsx';
export default function Onboarding({ signIn = false }: { signIn?: boolean }) {
  const [origin, setOrigin] = useState(''),
    [slug, setSlug] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState<{ site: Site; key: string }>();
  return (
    <div className="onboarding">
      <header>
        <a className="marketing-brand" href="/">
          arrival<span>↗</span>
        </a>
        <a href={signIn ? '/start' : '/login'}>{signIn ? 'Create a workspace' : 'Sign in'}</a>
      </header>
      <main>
        {created ? (
          <>
            <div className="onboarding-heading">
              <span className="setup-status">Workspace created</span>
              <h1>{created.site.name} is ready to connect.</h1>
              <p>
                These are the same installation steps every customer receives. Save your private
                integration key before leaving.
              </p>
              <a className="button primary" href={'/app/' + created.site.workspace}>
                Open your dashboard
              </a>
            </div>
            <CustomerSetup
              site={created.site}
              initialKey={created.key}
              copy={(value) => {
                void navigator.clipboard.writeText(value);
              }}
            />
          </>
        ) : (
          <div className="onboarding-form">
            <div>
              <span className="setup-status">
                {signIn ? 'Your workspace' : 'Meet your agent visitors'}
              </span>
              <h1>{signIn ? 'Welcome back.' : 'Start with your website.'}</h1>
              <p>
                {signIn
                  ? 'Use your workspace address to open its private dashboard.'
                  : 'Create a private workspace, install Arrival, and manage your questions in one place.'}
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (signIn) {
                  location.href = '/app/' + slug;
                  return;
                }
                setBusy(true);
                setError('');
                try {
                  const url = new URL(origin.startsWith('http') ? origin : 'https://' + origin);
                  const r = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: url.hostname.replace(/^www\./, ''),
                      origin: url.origin,
                      slug,
                      password,
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error ?? 'Could not create workspace.');
                  setCreated(d);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {!signIn && (
                <label>
                  Website
                  <input
                    autoFocus
                    placeholder="https://your-website.com"
                    value={origin}
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      try {
                        const u = new URL(
                          e.target.value.startsWith('http')
                            ? e.target.value
                            : 'https://' + e.target.value,
                        );
                        setSlug(
                          u.hostname
                            .replace(/^www\./, '')
                            .split('.')[0]
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, '')
                            .slice(0, 48),
                        );
                      } catch {}
                    }}
                    required
                  />
                </label>
              )}
              <label>
                Workspace address
                <div className="workspace-address">
                  <span>arrival /</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    pattern="[a-z0-9][a-z0-9-]{2,47}"
                    minLength={3}
                    maxLength={48}
                    placeholder="your-business"
                    required
                  />
                </div>
              </label>
              {!signIn && (
                <label>
                  Workspace password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <small>At least 12 characters. This protects your dashboard.</small>
                </label>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? 'Creating workspace…' : signIn ? 'Continue to sign in' : 'Create workspace'}
              </button>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
            </form>
            <p className="onboarding-footnote">
              A workspace is separate from your website’s visitors. Agents need no account.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
