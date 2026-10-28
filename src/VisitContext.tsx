import type { Visit } from './types.ts';

export function VisitContext({ visit }: { visit: Visit }) {
  const context = visit.attribution;
  if (!context) return null;
  return (
    <section className="visit-context" aria-label="Visitor context">
      <dl className="context-grid">
        <div>
          <dt>Provider</dt>
          <dd>
            {context.provider}
            <small>
              {context.client} · {context.ipSource}
            </small>
          </dd>
        </div>
        <div>
          <dt>Identity confidence</dt>
          <dd
            className={context.confidence === 'network corroborated' ? 'context-corroborated' : ''}
          >
            {context.confidence}
            <small>{context.explanation}</small>
          </dd>
        </div>
        <div>
          <dt>Crawler role</dt>
          <dd>
            {context.role}
            <small>
              {context.roleBasis}{' '}
              {context.roleDocs && (
                <a href={context.roleDocs} target="_blank" rel="noreferrer">
                  Provider documentation ↗
                </a>
              )}
            </small>
          </dd>
        </div>
        <div>
          <dt>Referral source</dt>
          <dd>
            {context.referral.source}
            <small>{context.referral.evidence}</small>
            {context.referral.searchQuery && (
              <p className="supplied-query">
                Supplied search query: <q>{context.referral.searchQuery}</q>
              </p>
            )}
          </dd>
        </div>
      </dl>
      {context.rangeCheck && (
        <details className="range-evidence">
          <summary>IP-range evidence · {context.rangeCheck.status}</summary>
          <p>
            Arrival address: <code>{visit.ip || 'Not supplied'}</code>
            {context.rangeCheck.prefix && (
              <>
                {' '}
                · Matching range: <code>{context.rangeCheck.prefix}</code>
              </>
            )}
          </p>
          <p>
            List checked:{' '}
            {context.rangeCheck.checkedAt
              ? new Date(context.rangeCheck.checkedAt).toLocaleString()
              : 'Unavailable'}
            . {context.rangeCheck.note}
          </p>
          {context.rangeCheck.source && (
            <a href={context.rangeCheck.source} target="_blank" rel="noreferrer">
              Official range feed ↗
            </a>
          )}
        </details>
      )}
    </section>
  );
}
export function Journey({ visit }: { visit: Visit }) {
  const journey = visit.journey;
  return (
    <section className="observed-journey" aria-label="Observed journey">
      <h3>Observed journey</h3>
      <p>
        Recorded requests, page views and clicks. These show activity, not the visitor’s private
        task.
      </p>
      {journey?.steps.length ? (
        <>
          <ol>
            {journey.steps.map((step, index) => (
              <li key={`${step.at}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <code>{step.path}</code>
                  <small>
                    {step.type.replaceAll('_', ' ')} · {step.source}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          {journey.total > journey.steps.length && (
            <p>
              First {journey.steps.length} of {journey.total} recorded steps. Latest path:{' '}
              <code>{journey.lastPath}</code>. The JSON export includes up to 1,500 recorded events
              per visit.
            </p>
          )}
        </>
      ) : (
        <p>
          No page activity recorded yet. Arrival path: <code>{visit.entryPath}</code>.
        </p>
      )}
    </section>
  );
}
export function ContextBreakdowns({ visits }: { visits: Visit[] }) {
  const rows = [
    { title: 'Providers', values: visits.map((v) => v.attribution?.provider ?? 'Unidentified') },
    { title: 'Crawler roles', values: visits.map((v) => v.attribution?.role ?? 'Not established') },
    {
      title: 'Referral sources',
      values: visits.map((v) => v.attribution?.referral.source ?? 'No referrer supplied'),
    },
  ];
  return (
    <section className="panel context-breakdowns" aria-label="Visitor context breakdowns">
      <div className="panel-heading">
        <div>
          <h2>Request evidence</h2>
          <p>Provider claims, crawler roles and referral sources across the latest visits</p>
        </div>
        <span className="quiet-count">Latest {visits.length}</span>
      </div>
      <div className="context-breakdown-panels">
        {rows.map((row) => {
          const counts = new Map<string, number>();
          for (const v of row.values) counts.set(v, (counts.get(v) ?? 0) + 1);
          const ranked = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
          const maximum = Math.max(1, ...ranked.map(([, count]) => count));
          return (
            <section className="context-breakdown" key={row.title}>
              <div className="context-breakdown-top">
                <h3>{row.title}</h3>
                <span>{counts.size ? `${counts.size} distinct` : 'No data yet'}</span>
              </div>
              <ul>
                {ranked.map(([name, count]) => (
                  <li key={name}>
                    <div>
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </div>
                    <span className="context-bar" aria-hidden="true">
                      <i style={{ width: `${(count / maximum) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              {!visits.length && <p className="quiet-empty">Waiting for your first visitor.</p>}
            </section>
          );
        })}
      </div>
      <p className="context-note">
        Provider names come from request headers; network corroboration uses official IP ranges.
        Role and referral evidence stay separate from the visitor’s declared task.
      </p>
    </section>
  );
}
