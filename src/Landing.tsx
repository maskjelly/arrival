import { useState } from 'react';
import { ArrowBendDownLeft, ArrowRight, Check, Code, Globe, Path } from '@phosphor-icons/react';
import { ActivityChart } from './ActivityChart.tsx';
import { ClientMark } from './ClientMark.tsx';
import './landing.css';
const exampleChart = [8, 14, 11, 24, 16, 32, 23].map((visits, i) => {
  const events = [13, 25, 20, 39, 31, 52, 44][i],
    claude = Math.floor(visits * 0.4),
    openai = Math.floor(visits * 0.45);
  return {
    time: new Date(Date.UTC(2026, 9, 21 + i)).toISOString(),
    visits,
    events,
    clients: {
      'Claude-User': { visits: claude, events: Math.floor(events * 0.4) },
      'ChatGPT-User': { visits: openai, events: Math.floor(events * 0.45) },
      'Other clients': {
        visits: visits - claude - openai,
        events: events - Math.floor(events * 0.4) - Math.floor(events * 0.45),
      },
    },
  };
});
export default function Landing() {
  const [step, setStep] = useState(0),
    [objective, setObjective] = useState('Compare API pricing for a small team.'),
    [mode, setMode] = useState<'interactive' | 'fetch'>('interactive');
  return (
    <div className="marketing">
      <a className="skip-link" href="#product-main">
        Skip to content
      </a>
      <header className="marketing-nav">
        <a href="/" className="marketing-brand">
          arrival<span>↗</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#experience">The experience</a>
          <a href="#understand">What you learn</a>
          <a href="#installation">Installation</a>
        </nav>
        <div>
          <a href="/login">Sign in</a>
          <a className="m-button" href="/start">
            Connect a website <ArrowRight size={14} />
          </a>
        </div>
      </header>
      <main id="product-main">
        <section className="m-hero">
          <div className="m-hero-copy">
            <p className="m-product-note">A small hello for the agent web.</p>
            <h1>
              Your next visitor
              <br />
              might be an agent.
            </h1>
            <p>
              See who’s finding your website, what they share, and where they go. Let them get on
              with it.
            </p>
            <div className="m-hero-actions">
              <a className="m-button" href="/start">
                Set up Arrival <ArrowRight size={16} />
              </a>
              <a className="m-text-link" href="#experience">
                See the introduction
              </a>
            </div>
          </div>
          <div className="m-preview-wrap">
            <div className="m-hand-note">
              the who, where
              <br />& a little why.
              <ArrowBendDownLeft size={39} />
            </div>
            <div className="m-workspace-preview">
              <div className="m-preview-toolbar">
                <div>
                  <span className="m-site-avatar">s</span>
                  <strong>smallwebsite.co</strong>
                </div>
                <span>Example workspace · illustrative data</span>
                <span>Oct 21 – 27</span>
              </div>
              <div className="m-preview-stats">
                {[
                  ['Visits', '128'],
                  ['Task summaries', '29'],
                  ['Countries', '12'],
                  ['Recorded events', '224'],
                ].map(([name, value]) => (
                  <div key={name}>
                    <span>{name}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <ActivityChart points={exampleChart} compact />
              <div className="m-preview-lists">
                <section>
                  <h3>
                    Who stopped by <span>Visits</span>
                  </h3>
                  {[
                    ['ChatGPT-User', '54'],
                    ['Claude-User', '48'],
                    ['Other clients', '26'],
                  ].map(([name, value]) => (
                    <div key={name}>
                      <ClientMark name={name} />
                      <span>{name}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </section>
                <section>
                  <h3>
                    Where they connected <span>Visits</span>
                  </h3>
                  {[
                    ['US', 'United States', '58'],
                    ['IN', 'India', '34'],
                    ['DE', 'Germany', '17'],
                  ].map(([code, name, value]) => (
                    <div key={code}>
                      <span className="country-code">{code}</span>
                      <span>{name}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        </section>
        <section className="m-experience" id="experience">
          <div className="m-section-title">
            <span className="handwritten">Nice to meet you. Carry on.</span>
            <h2>A hello, without a detour.</h2>
            <p>They came to your site to do something. Arrival fits around that task.</p>
          </div>
          <div className="m-experience-grid">
            <div className="m-doorway" aria-label="Interactive product example">
              <div className="m-demo-header">
                <Globe size={15} />
                <span>your-website.com / pricing</span>
                <span className="m-demo-tag">Try it</span>
              </div>
              <div className="m-mode-picker" role="group" aria-label="Example visitor tool">
                <button
                  aria-pressed={mode === 'interactive'}
                  onClick={() => {
                    setMode('interactive');
                    setStep(0);
                  }}
                >
                  Interactive agent
                </button>
                <button
                  aria-pressed={mode === 'fetch'}
                  onClick={() => {
                    setMode('fetch');
                    setStep(0);
                  }}
                >
                  Read-only fetch
                </button>
              </div>
              <div className="m-demo-body" key={`${mode}:${step}`}>
                {step === 0 ? (
                  <>
                    <span className="m-agent-symbol">
                      <ClientMark name={mode === 'fetch' ? 'Claude-User' : 'Agent'} size={26} />
                    </span>
                    <span className="m-demo-label">An ordinary agent visit</span>
                    <h3>“Find the right plan for our team.”</h3>
                    <p>
                      A search result brings it to your pricing page. Nobody briefed it about
                      Arrival.
                    </p>
                    <button className="m-button" onClick={() => setStep(mode === 'fetch' ? 2 : 1)}>
                      Follow the visit <ArrowRight size={15} />
                    </button>
                  </>
                ) : step === 1 ? (
                  <>
                    <span className="m-demo-label">A quick introduction</span>
                    <h3>You’re in the right place.</h3>
                    <p>A little context, then back to the pricing page.</p>
                    <label htmlFor="example-task">What are you here to do?</label>
                    <textarea
                      id="example-task"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={2}
                    />
                    <button
                      className="m-button"
                      onClick={() => setStep(2)}
                      disabled={!objective.trim()}
                    >
                      Continue to the website
                    </button>
                    <small>No account. No CAPTCHA. Just a short summary.</small>
                  </>
                ) : (
                  <>
                    <span className="m-success-symbol">
                      <Check size={25} />
                    </span>
                    <span className="m-demo-label">Back to the original task</span>
                    <h3>The pricing page is open.</h3>
                    <div className="m-receipt">
                      <span>Declared task</span>
                      <p>
                        {mode === 'fetch'
                          ? 'Unknown. This tool reads pages without answering forms.'
                          : objective}
                      </p>
                      <span>Observed next</span>
                      <p>/pricing → /docs → /integrations</p>
                    </div>
                    <button className="m-text-link" onClick={() => setStep(0)}>
                      Replay the example
                    </button>
                  </>
                )}
              </div>
              <div className="m-demo-footer">
                An example visit. Your real traffic stays in your workspace.
              </div>
            </div>
            <div className="m-flow-list">
              <article>
                <span>
                  <Path size={22} />
                </span>
                <div>
                  <h3>They find you, as usual.</h3>
                  <p>From a search, a link, or a recommendation. No special starting point.</p>
                </div>
              </article>
              <article>
                <span>?</span>
                <div>
                  <h3>A little context, when possible.</h3>
                  <p>
                    Interactive agents meet your questions. Known read-only fetchers keep reading,
                    with intent marked unknown.
                  </p>
                </div>
              </article>
              <article>
                <span>
                  <ArrowRight size={22} />
                </span>
                <div>
                  <h3>Same destination. More understanding.</h3>
                  <p>
                    Keep the original page and task. Follow the requests, declared answers and
                    browser activity you receive.
                  </p>
                </div>
              </article>
              <div className="m-side-note">
                Your website. Their task.
                <br />
                Room for both.
              </div>
            </div>
          </div>
        </section>
        <section className="m-understand" id="understand">
          <div className="m-section-title">
            <h2>
              Every visit leaves a trail.
              <br />
              Now you can read it.
            </h2>
            <p>
              The useful bits in one place. With a clear line between what happened and what someone
              told you.
            </p>
          </div>
          <div className="m-evidence-sheet">
            <div className="m-evidence-heading">
              <span>What you learn</span>
              <span>Where it comes from</span>
            </div>
            <article>
              <div>
                <ClientMark name="Claude-User" />
                <h3>The client at your door</h3>
                <p>Agent names and automation signals, with the evidence attached.</p>
              </div>
              <span>Request headers & browser signals</span>
            </article>
            <article>
              <div>
                <span className="m-question-mark">?</span>
                <h3>What brought them here</h3>
                <p>Your questions, their words. Unknown means unknown.</p>
              </div>
              <span>Answers shared by the visitor</span>
            </article>
            <article>
              <div>
                <Globe size={23} />
                <h3>Where the connection starts</h3>
                <p>Countries, states and network operators. A proxy may be part of the story.</p>
              </div>
              <span>Approximate IP location & ASN</span>
            </article>
            <article>
              <div>
                <Path size={23} />
                <h3>The next page. And the next.</h3>
                <p>Requests, browser actions and the introduction funnel.</p>
              </div>
              <span>Observed or integration-reported activity</span>
            </article>
          </div>
        </section>
        <section className="m-install" id="installation">
          <div>
            <span className="handwritten">A small addition to your site.</span>
            <h2>
              Plug it in.
              <br />
              Let visitors happen.
            </h2>
            <p>
              Create a workspace, add the integration, and deploy. Change your questions from the
              dashboard whenever you like.
            </p>
            <a className="m-button" href="/start">
              Connect your website <ArrowRight size={16} />
            </a>
          </div>
          <div className="m-install-sheet">
            <div>
              <span>
                <Code size={17} /> Next.js
              </span>
              <span>Server + browser</span>
            </div>
            <pre>{"export { middleware } from '@arrival/next';"}</pre>
            <p>
              Add the browser component and your three environment variables. Your workspace gives
              you the exact steps.
            </p>
            <div className="m-install-separator" />
            <div>
              <span>Wix, Shopify & HTML</span>
              <span>Browser collection</span>
            </div>
            <p>
              A small snippet observes browser activity. A server or edge integration is needed to
              put questions before HTTP content.
            </p>
            <span className="m-install-note">Same setup for Whiteye. Same setup for you.</span>
          </div>
        </section>
        <section className="m-honest">
          <div>
            <span className="handwritten">A few things, straight up.</span>
            <h2>Curious. Never clairvoyant.</h2>
          </div>
          <div>
            <details>
              <summary>Can you tell me what every agent wants?</summary>
              <p>
                Only when it shares a task summary. Request analytics do not reveal private prompts.
                HTTP fetch tools receive the content with intent marked unknown.
              </p>
            </details>
            <details>
              <summary>Will Arrival block my visitors?</summary>
              <p>
                Interactive agents can meet a short introduction. HTTP fetches and search indexers
                read without questions. Collector outages fail open so the website stays available.
                Detection is imperfect; zero churn cannot be promised.
              </p>
            </details>
            <details>
              <summary>Is this a security firewall?</summary>
              <p>
                No. Header claims can be spoofed and robots.txt is guidance. Keep your existing
                authorization for private content. Arrival is an observability layer.
              </p>
            </details>
          </div>
        </section>
        <section className="m-last-call">
          <span className="handwritten">Wonder who’s there?</span>
          <h2>
            Leave the door open.
            <br />
            Keep an eye on the arrivals.
          </h2>
          <a className="m-button" href="/start">
            Create your workspace <ArrowRight size={16} />
          </a>
        </section>
      </main>
      <footer className="marketing-footer">
        <a className="marketing-brand" href="/">
          arrival<span>↗</span>
        </a>
        <p>Good to know who’s stopping by.</p>
        <div>
          <a href="/login">Customer sign in</a>
          <a href="https://github.com/maskjelly/arrival">Source & documentation</a>
        </div>
      </footer>
    </div>
  );
}
