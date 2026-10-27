import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code,
  FileText,
  ListChecks,
  Path,
  Robot,
  X,
} from '@phosphor-icons/react';
import BuildStatus from './BuildStatus.tsx';
import './landing.css';

const examples = [
  {
    name: 'Research',
    question: 'What are you trying to learn?',
    objective: 'Find a data API with a Python SDK and clear usage limits.',
    pages: ['/docs', '/integrations', '/pricing'],
    result: 'Read the API specification',
    kind: 'Read pages · Search · Download',
  },
  {
    name: 'Compare',
    question: 'What matters in your evaluation?',
    objective: 'Compare the Team plan with our current provider for a six-person team.',
    pages: ['/pricing', '/security', '/docs'],
    result: 'Saved a plan to the shortlist',
    kind: 'Read pages · Search',
  },
  {
    name: 'Integrate',
    question: 'What are you building?',
    objective: 'Check authentication and webhook support before starting an integration.',
    pages: ['/docs', '/integrations', '/security'],
    result: 'Downloaded the specification',
    kind: 'Read pages · Download',
  },
];

function Wordmark() {
  return (
    <a className="landing-brand" href="/" aria-label="Arrival home">
      <span className="wordmark-icon">
        <Path size={25} weight="bold" />
      </span>
      arrival<span className="wordmark-dot">.</span>
    </a>
  );
}

export default function Landing() {
  const [example, setExample] = useState(0);
  const [menu, setMenu] = useState(false);
  const current = examples[example];
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-nav">
        <Wordmark />
        <nav className={menu ? 'open' : ''} aria-label="Main navigation">
          <a href="#product" onClick={() => setMenu(false)}>
            The product
          </a>
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#build-status" onClick={() => setMenu(false)}>
            Built & next
          </a>
        </nav>
        <a className="sewn-button black-button nav-cta" href="/app">
          Open workspace <ArrowUpRight size={17} />
        </a>
        <button
          className="landing-menu"
          aria-label={menu ? 'Close menu' : 'Open menu'}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? <X size={23} /> : <ListChecks size={23} />}
        </button>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="fabric-label hero-label">
              <span className="thread-cross" />
              Agent analytics, with a proper introduction
            </span>
            <h1>
              They visit your site.
              <br />
              Get to know why.
            </h1>
            <p>
              Understand AI visits without slowing them down.
              <br className="desktop-break" /> Follow the task, the pages, and what happens next.
            </p>
            <div className="hero-actions">
              <a className="sewn-button black-button" href="/app">
                Explore the workspace <ArrowUpRight size={19} />
              </a>
              <a className="sewn-button pink-button" href="/lab">
                Try the agent check-in <ArrowRight size={18} />
              </a>
            </div>
            <span className="hero-note">A working local MVP. No sign-up or model key needed.</span>
          </div>
          <div className="hero-stitch left-stitch" aria-hidden="true" />
          <div className="hero-stitch right-stitch" aria-hidden="true" />
          <div className="arrival-preview">
            <div className="preview-top">
              <span className="preview-title">
                <span className="tiny-logo">
                  <Path size={17} />
                </span>
                A little context goes a long way.
              </span>
              <span className="example-label">Illustrative visit</span>
            </div>
            <div className="preview-main">
              <section className="preview-declaration">
                <div className="preview-agent">
                  <span className="cloth-avatar">
                    <Robot size={26} />
                  </span>
                  <div>
                    <strong>An agent has arrived.</strong>
                    <small>Start with a question, not an assumption.</small>
                  </div>
                </div>
                <div className="example-switch" aria-label="Choose an example task">
                  {examples.map((item, i) => (
                    <button
                      key={item.name}
                      aria-pressed={example === i}
                      onClick={() => setExample(i)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="example-answer" key={example}>
                  <span>{current.question}</span>
                  <p>“{current.objective}”</p>
                  <div className="answer-stamp">
                    <Check size={13} />
                    Self-reported objective
                  </div>
                </div>
                <div className="example-permissions">
                  <span>Requested actions</span>
                  <strong>{current.kind}</strong>
                </div>
              </section>
              <section className="preview-trail">
                <div className="trail-title">
                  <Path size={19} />
                  <h2>Then follow the thread.</h2>
                </div>
                <ol>
                  {current.pages.map((path, index) => (
                    <li key={path + index}>
                      <span className="trail-node">
                        <FileText size={13} />
                      </span>
                      <div>
                        <span>Page viewed</span>
                        <code>{path}</code>
                      </div>
                      <Check size={13} />
                    </li>
                  ))}
                  <li className="trail-result">
                    <span className="trail-node">
                      <Check size={14} />
                    </span>
                    <div>
                      <span>Observed outcome</span>
                      <strong>{current.result}</strong>
                    </div>
                  </li>
                </ol>
                <p>
                  What the visitor said. What your website observed.
                  <br />
                  Kept separate, connected in one visit.
                </p>
              </section>
            </div>
            <div className="preview-foot">
              <span>
                <span className="stitched-square" />
                Questions you choose. Context you can inspect.
              </span>
              <a href="/app">
                See the working product <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          <div className="hero-bottom">
            <span>Made for the web’s other visitors.</span>
            <div>
              <span>Browser agents</span>
              <span>HTTP clients</span>
              <span>AI crawlers</span>
              <span>Computer use</span>
            </div>
          </div>
        </section>

        <section id="product" className="product-section landing-section">
          <div className="section-intro">
            <span className="fabric-label light-label">The whole visit, stitched together</span>
            <h2>
              Go beyond
              <br />
              another bot count.
            </h2>
            <p>
              A request tells you a page was fetched. Arrival gives you a place to ask about the
              task behind it.
            </p>
            <a className="underlined-link" href="/app">
              Explore your visit records <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="product-details">
            <article>
              <span className="detail-symbol">
                <ListChecks size={24} />
              </span>
              <div>
                <h3>Ask your own questions.</h3>
                <p>
                  Objectives, evaluation criteria, discovery sources, and whatever matters to your
                  website. Make answers required or leave them optional.
                </p>
                <div className="question-sample">
                  <span>What would make this visit successful?</span>
                  <div>
                    A short answer, in the visitor’s own words.
                    <span className="sample-cursor" />
                  </div>
                </div>
              </div>
            </article>
            <article>
              <span className="detail-symbol">
                <Path size={24} />
              </span>
              <div>
                <h3>See what actually happened.</h3>
                <p>
                  Connect declared purpose to page views, searches, downloads, and recorded actions.
                  Inspect the original evidence and export the record.
                </p>
                <div className="inline-trail">
                  <code>/docs</code>
                  <span className="thread-link" />
                  <code>/pricing</code>
                  <span className="thread-link" />
                  <span className="outcome-tag">
                    <Check size={13} />
                    Downloaded
                  </span>
                </div>
              </div>
            </article>
            <article>
              <span className="detail-symbol">
                <Code size={24} />
              </span>
              <div>
                <h3>Connect the way your site works.</h3>
                <p>
                  A browser script for optional check-in and interaction data. A server collector
                  for requests that never execute JavaScript.
                </p>
                <div className="connection-tags">
                  <span>Browser script</span>
                  <span>Wix · Shopify · Next.js</span>
                  <span>HTTP API</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="how-section landing-section">
          <div className="section-heading">
            <span className="fabric-label light-label">A simple first conversation</span>
            <h2>
              From “who’s there?”
              <br />
              to “here’s what happened.”
            </h2>
            <p>Three parts. One record you can actually understand.</p>
          </div>
          <div className="how-steps">
            <article>
              <span className="step-tag">01 / Connect</span>
              <h3>Give visits a place to land.</h3>
              <p>
                Add the browser tracker or report requests from your server. Start with the open
                demo to see the complete flow.
              </p>
              <span className="step-icon">
                <Code size={36} />
              </span>
            </article>
            <article>
              <span className="step-tag">02 / Ask</span>
              <h3>Let the visitor explain.</h3>
              <p>
                Choose your questions. Browser agents can open a small optional prompt; HTTP agents
                can discover a structured reporting API.
              </p>
              <span className="step-icon">
                <ListChecks size={36} />
              </span>
            </article>
            <article>
              <span className="step-tag">03 / Understand</span>
              <h3>Keep the task and the trail.</h3>
              <p>
                Read the answers beside recorded activity. Inspect signals, filter visits, and take
                the data with you.
              </p>
              <span className="step-icon">
                <Path size={36} />
              </span>
            </article>
          </div>
          <p className="honesty-note">
            <span className="stitched-square" />
            Your website stays open. Questions are optional, the prompt never takes focus, and
            collection failures do not block the task.
          </p>
        </section>

        <section id="build-status" className="status-section landing-section">
          <div className="section-heading">
            <span className="fabric-label light-label">Open about where we are</span>
            <h2>
              A real MVP.
              <br />
              An honest to-build list.
            </h2>
            <p>What is implemented now, what comes next, and what runs underneath.</p>
          </div>
          <BuildStatus compact />
        </section>

        <section className="faq-section landing-section">
          <h2>
            A few things
            <br />
            worth knowing.
          </h2>
          <div>
            <article>
              <h3>Can Arrival identify every agent?</h3>
              <p>
                No. This MVP uses basic request and browser signals. Unknown visitors remain
                unknown, and operator identities are unverified.
              </p>
            </article>
            <article>
              <h3>Does it know the original user prompt?</h3>
              <p>
                No. A visitor can share a task summary through your questionnaire. That declaration
                is kept separate from observed activity.
              </p>
            </article>
            <article>
              <h3>Can I use it on my website?</h3>
              <p>
                Copy the snippet for Wix, Shopify, Next.js, or any website that accepts custom code.
                Host Arrival on HTTPS for remote collection. HTTP-only crawler requests also need
                server or CDN collection.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-final">
          <span className="fabric-label">Say hello to the other side of your traffic.</span>
          <h2>
            Give every arrival
            <br />a little more context.
          </h2>
          <a className="sewn-button black-button" href="/app">
            Open your workspace <ArrowUpRight size={20} />
          </a>
          <div className="final-thread" aria-hidden="true" />
        </section>
      </main>
      <footer className="landing-footer">
        <Wordmark />
        <p>Agent visits, with context.</p>
        <div>
          <a href="#build-status">Stack & build status</a>
          <a href="/app">Workspace</a>
          <a href="/lab">
            Try check-in <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
