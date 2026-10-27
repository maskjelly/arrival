import { Check, ArrowUpRight, Code, Stack } from '@phosphor-icons/react';
import { builtFeatures, nextFeatures, stack } from './project.ts';

export default function BuildStatus({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`build-status ${compact ? 'compact' : ''}`}>
      <div className="build-columns">
        <section className="build-column built-column">
          <div className="build-column-heading">
            <span className="section-label">
              <Check size={15} weight="bold" />
              Working today
            </span>
            <span>{builtFeatures.length} pieces in place</span>
          </div>
          <div className="build-items">
            {builtFeatures.map((item) => (
              <article key={item.title}>
                <Check size={18} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="build-column next-column">
          <div className="build-column-heading">
            <span className="section-label light-label">
              <ArrowUpRight size={15} />
              Still to build
            </span>
            <span>No delivery dates promised</span>
          </div>
          <div className="build-items">
            {nextFeatures.map((item) => (
              <article key={item.title}>
                <span className="pending-dot" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="stack-section">
        <div className="stack-heading">
          <Stack size={24} />
          <div>
            <h2>A small, understandable stack.</h2>
            <p>One application process and a local database. No model API key is required.</p>
          </div>
        </div>
        <div className="stack-list">
          {stack.map((item) => (
            <div key={item.name}>
              <Code size={18} />
              <strong>{item.name}</strong>
              <p>{item.role}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
