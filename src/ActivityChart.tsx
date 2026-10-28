import { useId, useMemo, useState } from 'react';
import { ClientMark } from './ClientMark.tsx';
import type { Overview } from './types.ts';
import './analytics.css';
type Point = Overview['chart'][number];
const number = (v: number) =>
  new Intl.NumberFormat('en', { notation: v > 9999 ? 'compact' : 'standard' }).format(v);
export function ActivityChart({
  points,
  empty = false,
  compact = false,
}: {
  points: Point[];
  empty?: boolean;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, ''),
    [client, setClient] = useState(''),
    [active, setActive] = useState<number | null>(null);
  const clients = useMemo(
    () => [...new Set(points.flatMap((p) => Object.keys(p.clients ?? {})))].sort(),
    [points],
  );
  const selected = clients.includes(client) ? client : '';
  const chart = points.map((p) => ({
    ...p,
    ...(selected ? (p.clients?.[selected] ?? { visits: 0, events: 0 }) : {}),
  }));
  const width = 1000,
    height = compact ? 235 : 300,
    left = 36,
    right = 18,
    top = 22,
    bottom = 35;
  const maximum = Math.max(4, ...chart.flatMap((p) => [p.events, p.visits]));
  const x = (i: number) => left + (i * (width - left - right)) / Math.max(1, chart.length - 1);
  const y = (value: number) => top + (height - top - bottom) * (1 - value / maximum);
  const line = (key: 'events' | 'visits') =>
    chart.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ');
  const point = active === null ? undefined : chart[active];
  const label = (value: string) =>
    new Date(value).toLocaleString(
      'en-GB',
      points.length > 7
        ? { hour: '2-digit', minute: '2-digit' }
        : { month: 'short', day: 'numeric' },
    );
  return (
    <div className={`activity-chart ${compact ? 'compact' : ''}`}>
      <div className="activity-toolbar">
        <div>
          <h2>Traffic over time</h2>
          <span>Visits and the trail they leave</span>
        </div>
        <label className="client-select">
          <span className="sr-only">Chart client</span>
          {selected ? (
            <ClientMark name={selected} />
          ) : (
            <span className="client-stack">
              <ClientMark name="OpenAI" />
              <ClientMark name="Claude" />
              <ClientMark name="Perplexity" />
            </span>
          )}
          <select
            aria-label="Chart client"
            value={selected}
            onChange={(e) => {
              setClient(e.target.value);
              setActive(null);
            }}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="activity-plot" onPointerLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={empty ? 'No traffic recorded yet.' : 'Event and visit counts over time.'}
        >
          <defs>
            <linearGradient id={'fill' + id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bd466f" stopOpacity=".14" />
              <stop offset="100%" stopColor="#bd466f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <g key={r}>
              <line
                x1={left}
                x2={width - right}
                y1={y(maximum * r)}
                y2={y(maximum * r)}
                stroke="#e8e5e2"
                strokeDasharray="4 7"
              />
              <text
                x={left - 12}
                y={y(maximum * r) + 4}
                textAnchor="end"
                fill="#77716d"
                fontSize="11"
              >
                {number(Math.round(maximum * r))}
              </text>
            </g>
          ))}
          {!empty && chart.length > 0 && (
            <>
              <path
                d={`${line('events')} L${x(chart.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                fill={`url(#fill${id})`}
              />
              <path
                d={line('visits')}
                fill="none"
                stroke="#918b86"
                strokeWidth="1.8"
                strokeDasharray="5 5"
              />
              <path
                d={line('events')}
                fill="none"
                stroke="#b53b65"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {point && active !== null && (
                <>
                  <line
                    x1={x(active)}
                    x2={x(active)}
                    y1={top}
                    y2={y(0)}
                    stroke="#827c77"
                    strokeDasharray="4 5"
                  />
                  <circle
                    cx={x(active)}
                    cy={y(point.events)}
                    r="5"
                    fill="white"
                    stroke="#b53b65"
                    strokeWidth="3"
                  />
                </>
              )}
            </>
          )}
          {chart.map(
            (p, i) =>
              (i === 0 || i === chart.length - 1 || i % Math.ceil(chart.length / 5) === 0) && (
                <text
                  key={p.time}
                  x={x(i)}
                  y={height - 7}
                  textAnchor={i === 0 ? 'start' : i === chart.length - 1 ? 'end' : 'middle'}
                  fill="#77716d"
                  fontSize="11"
                >
                  {label(p.time)}
                </text>
              ),
          )}
          {chart.map((p, i) => (
            <rect
              key={p.time}
              x={x(i) - (width - left - right) / Math.max(1, chart.length - 1) / 2}
              y={top}
              width={(width - left - right) / Math.max(1, chart.length - 1)}
              height={height - top - bottom}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
              onPointerMove={() => setActive(i)}
            />
          ))}
        </svg>
        {empty && (
          <div className="activity-empty">
            <strong>A little quiet here. For now.</strong>
            <p>Your first visit will put this chart to work.</p>
          </div>
        )}
        {point && active !== null && (
          <div
            className={`activity-tooltip ${active > chart.length * 0.6 ? 'tooltip-left' : ''}`}
            role="status"
            style={{ left: `${Math.min(76, Math.max(4, (x(active) / width) * 100))}%` }}
          >
            <strong>
              {new Date(point.time).toLocaleString('en-GB', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
            <div>
              <span>Visits</span>
              <b>{number(point.visits)}</b>
            </div>
            <div>
              <span>Events</span>
              <b>{number(point.events)}</b>
            </div>
            {!selected &&
              Object.entries(point.clients ?? {})
                .sort((a, b) => b[1].visits - a[1].visits)
                .slice(0, 3)
                .map(([name, data]) => (
                  <div className="tooltip-client" key={name}>
                    <span>
                      <ClientMark name={name} size={14} />
                      {name}
                    </span>
                    <b>{data.visits}</b>
                  </div>
                ))}
          </div>
        )}
      </div>
      <div className="activity-footer">
        <div className="chart-legend">
          <span>
            <i />
            Events
          </span>
          <span>
            <i />
            Visits
          </span>
        </div>
        <label>
          <span className="sr-only">Inspect time bucket</span>
          <input
            aria-label="Inspect time bucket"
            type="range"
            min="0"
            max={Math.max(0, chart.length - 1)}
            value={active ?? chart.length - 1}
            onChange={(e) => setActive(Number(e.target.value))}
          />
          <span>{active !== null && point ? label(point.time) : 'Hover or scrub to explore'}</span>
        </label>
      </div>
    </div>
  );
}
