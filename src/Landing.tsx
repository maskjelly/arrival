import { useState } from 'react';
import './landing.css';
export default function Landing() {
  const [step, setStep] = useState(0),
    [objective, setObjective] = useState('Compare API pricing for a small team.');
  return (
    <div className="marketing">
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
            Connect a website
          </a>
        </div>
      </header>
      <main>
        <section className="m-hero">
          <div className="m-hero-copy">
            <div className="m-product-note">
              <span />
              For the agent traffic already finding you
            </div>
            <h1>Meet the agents at your door.</h1>
            <p>
              They arrive with a job to do. Ask a little about it, let them continue, and understand
              what happens next.
            </p>
            <div className="m-hero-actions">
              <a className="m-button" href="/start">
                Set up Arrival
              </a>
              <a className="m-text-link" href="#experience">
                See the introduction
              </a>
            </div>
            <div className="m-hero-footnote">
              Your questions. Their original destination.
              <br />A small introduction, not a new workflow.
            </div>
          </div>
          <div className="m-doorway" aria-label="Interactive product example">
            <div className="m-demo-header">
              <span className="m-site-dot" />
              <span>your-website.com / pricing</span>
              <span className="m-demo-tag">Example</span>
            </div>
            <div className="m-demo-path">
              <span className={step === 0 ? 'current' : ''}>Arrives</span>
              <span>→</span>
              <span className={step === 1 ? 'current' : ''}>Introduces task</span>
              <span>→</span>
              <span className={step === 2 ? 'current' : ''}>Continues</span>
            </div>
            <div className="m-demo-body">
              {step === 0 ? (
                <>
                  <div className="m-agent-symbol">↳</div>
                  <span className="m-demo-label">An ordinary agent visit</span>
                  <h2>“Find the right plan for our team.”</h2>
                  <p>
                    The agent follows a search result to your pricing page. Nobody has told it about
                    Arrival.
                  </p>
                  <button className="m-button" onClick={() => setStep(1)}>
                    Follow the visit
                  </button>
                </>
              ) : step === 1 ? (
                <>
                  <span className="m-demo-label">A quick introduction</span>
                  <h2>You’re in the right place.</h2>
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
                  <small>No account. No CAPTCHA. A short task summary.</small>
                </>
              ) : (
                <>
                  <div className="m-success-symbol">✓</div>
                  <span className="m-demo-label">Back to the original task</span>
                  <h2>The pricing page is open.</h2>
                  <div className="m-receipt">
                    <span>Declared task</span>
                    <p>{objective}</p>
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
              Illustrative visit. Real visits appear only in your private workspace.
            </div>
          </div>
        </section>
        <section className="m-experience" id="experience">
          <div className="m-section-title">
            <span>The introduction</span>
            <h2>Keep the task moving.</h2>
            <p>An agent shouldn’t need a new mission to tell you about its current one.</p>
          </div>
          <div className="m-flow-list">
            <article>
              <span className="m-flow-number">1</span>
              <div>
                <h3>It arrives naturally.</h3>
                <p>
                  A search result, a citation, a link. Arrival meets recognized interactive agents
                  at the page they requested.
                </p>
              </div>
              <div className="m-flow-sample">GET /your-page</div>
            </article>
            <article>
              <span className="m-flow-number">2</span>
              <div>
                <h3>Your website asks.</h3>
                <p>
                  A readable introduction uses your questions. Forms and a URL-based path
                  accommodate different tool capabilities.
                </p>
              </div>
              <div className="m-flow-sample">A sentence is plenty.</div>
            </article>
            <article>
              <span className="m-flow-number">3</span>
              <div>
                <h3>It carries on.</h3>
                <p>
                  An expiring, site-bound pass preserves the destination. Subsequent visits in the
                  session don’t repeat the questions.
                </p>
              </div>
              <div className="m-flow-sample">Continue /your-page</div>
            </article>
          </div>
        </section>
        <section className="m-understand" id="understand">
          <div className="m-section-title">
            <span>The workspace</span>
            <h2>A visit has more to tell you.</h2>
            <p>
              What the agent says, where it connects from, and what you actually observe—kept
              distinct.
            </p>
            <a className="m-text-link" href="/start">
              Create your private workspace
            </a>
          </div>
          <div className="m-evidence">
            <div className="m-evidence-row">
              <span className="m-evidence-icon">?</span>
              <div>
                <h3>Intent, in its own words</h3>
                <p>
                  Your questions, declared objectives and the answer version that each visitor saw.
                </p>
              </div>
              <small>Self-reported</small>
            </div>
            <div className="m-evidence-row">
              <span className="m-evidence-icon">↗</span>
              <div>
                <h3>The path through your website</h3>
                <p>
                  Page arrivals, answers and continuation. See where introductions complete or stop
                  producing signals.
                </p>
              </div>
              <small>Observed / reported</small>
            </div>
            <div className="m-evidence-row">
              <span className="m-evidence-icon">◎</span>
              <div>
                <h3>Countries, states and networks</h3>
                <p>
                  Approximate IP location and ASN ownership. Useful context without pretending to
                  identify the person behind the agent.
                </p>
              </div>
              <small>IP-derived</small>
            </div>
          </div>
        </section>
        <section className="m-install" id="installation">
          <div>
            <span className="m-kicker">Set up, then manage from here</span>
            <h2>
              A client integration.
              <br />
              Not a custom project.
            </h2>
            <p>
              Create a workspace. Install the package. Set your environment variables and deploy.
              Questions and entry behavior stay configurable in your dashboard.
            </p>
            <a className="m-button" href="/start">
              Connect your website
            </a>
          </div>
          <div className="m-install-sheet">
            <div>
              <span>Next.js</span>
              <span>Server entry + browser signals</span>
            </div>
            <pre>{"export { middleware } from '@arrival/next';"}</pre>
            <p>
              The setup screen provides the versioned package URL and your workspace’s exact
              configuration.
            </p>
            <div className="m-install-separator" />
            <div>
              <span>Wix, Shopify, HTML</span>
              <span>Browser collection</span>
            </div>
            <p>
              A snippet collects browser signals and shows a gentle prompt. Enforcing questions
              before HTTP content requires a server or edge integration.
            </p>
          </div>
        </section>
        <section className="m-honest">
          <h2>Good introductions need honest boundaries.</h2>
          <div>
            <p>
              Robots.txt and discovery links are guidance, not access control. The server
              integration enforces the question step for detected interactive agents while it is
              healthy.
            </p>
            <p>
              Agent detection is imperfect. Browser impersonation can evade it. Known fetch-only
              tools (such as Claude chat) and search indexers read without questions; their intent
              stays unknown. Collector outages don’t take your website down. Arrival measures the
              response; it cannot promise zero churn.
            </p>
            <p>
              Answers are declarations. IPs may locate a proxy or remote browser. This MVP does not
              verify agent identity or recover private prompts.
            </p>
          </div>
        </section>
      </main>
      <footer className="marketing-footer">
        <a className="marketing-brand" href="/">
          arrival<span>↗</span>
        </a>
        <p>A thoughtful first hello for the agent web.</p>
        <div>
          <a href="/login">Customer sign in</a>
          <a href="https://github.com/maskjelly/arrival">Source & documentation</a>
        </div>
      </footer>
    </div>
  );
}
