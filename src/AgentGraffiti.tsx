import type { CSSProperties } from 'react';

/** Original ink-and-paper characters for Arrival. Decorative, never a source of visitor data. */
export function AgentDoodle({
  kind = 'scout',
  className = '',
}: {
  kind?: 'scout' | 'reader' | 'courier';
  className?: string;
}) {
  return (
    <svg
      className={`agent-doodle ${className}`}
      viewBox="0 0 200 230"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="#292624" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'scout' ? (
          <>
            <path d="M54 130C34 137 31 160 24 174M146 129C166 115 172 104 174 84" />
            <path d="M21 176l-5-12m8 10 8-8m141-83-8-3m10 2 3-12" />
            <path d="m75 179-9 30-23 6m77-36 13 27 23 4" />
            <path d="M56 135c13-16 69-18 83-1l-4 48c-22 9-57 10-78-2z" fill="#f5bdd1" />
            <path d="m68 151 57-2m-52 15 44 1" stroke="#bd6d8b" />
            <path d="M42 67c1-20 111-27 117-3l-3 62c-20 16-97 17-112-2z" fill="#fffdfb" />
            <path d="M44 76c26-7 83-11 112-3M91 55l-2-25" />
            <path d="M82 29c-3-11 13-16 17-5s-10 16-17 5" fill="#f5bdd1" />
            <rect x="27" y="86" width="14" height="26" rx="5" fill="#f5bdd1" />
            <rect x="158" y="82" width="13" height="27" rx="5" fill="#f5bdd1" />
            <path d="m70 93 1 10m54-13-1 10" strokeWidth="8" />
            <path d="M86 114c9 8 16 7 24-2" />
            <path d="m45 219 27-2m59-3 27 2" strokeWidth="5" />
          </>
        ) : kind === 'reader' ? (
          <>
            <path
              d="M43 101C34 54 57 29 91 34c36-7 65 27 60 60l-5 67-22 15-23-9-23 12-29-15z"
              fill="#f5bdd1"
            />
            <path d="m70 72 1 10m48-12-1 10" strokeWidth="7" />
            <path d="m88 92 17-1M75 38l-5-15m49 12 10-13" />
            <path d="M42 117c-15-12-22-5-16 8l21 18m106-29c17-10 23 0 14 10l-20 16" />
            <path
              d="M36 111c19-4 38 0 60 12 22-14 42-18 64-13l-2 65c-23-4-39 0-60 12-21-12-39-15-60-9z"
              fill="#fffdfb"
            />
            <path
              d="m97 125 1 60m-47-54 28 7m-27 4 26 7m-25 4 24 6m38-25 30-9m-29 20 27-8m-27 19 26-7"
              strokeWidth="2"
            />
            <path d="m69 186-8 24-18 4m84-29 10 23 19 2m-112 9 22-2m70-2 22 1" />
          </>
        ) : (
          <>
            <path d="M54 84 41 56l24 11m72 14 16-26-25 12" fill="#f5bdd1" />
            <path d="M43 82c20-17 91-18 110 0l-3 49c-23 18-85 21-106 3z" fill="#fffdfb" />
            <path d="m72 102 1 9m52-12-1 9" strokeWidth="8" />
            <path d="m89 122 18-2" />
            <path d="M60 143c-6 15-5 31 0 44l65 4 14-44" fill="#f5bdd1" />
            <path d="m59 161-25-14m101 17 28-21M72 190l-18 20-18 2m77-20 15 19 25 3" />
            <path d="m31 114 61 7 19 48-64-7z" fill="#fffdfb" />
            <path d="m44 130 39 5m-34 6 35 4m-30 7 24 2" strokeWidth="2" />
            <path d="m158 137 9-12m-5 15 14-3m-139 81 20-1m72 1 26 3" />
          </>
        )}
      </g>
      <g stroke="#ad315a" strokeWidth="2" strokeLinecap="round">
        <path d="m18 39 6-12m-7 7 11 3m145 157 9-10m-10 3 10 5" />
        <path d="M14 201c10-4 18-3 25 0" strokeDasharray="2 5" />
      </g>
    </svg>
  );
}
export function Scribble({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`agent-scribble ${className}`}
      style={style}
      viewBox="0 0 220 80"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 40C52 7 106 12 150 35s38 25 60 8M16 50c63-30 121-7 186 4" />
        <path d="m195 32 16 11-8 17" />
      </g>
    </svg>
  );
}
export function HeroGraffiti() {
  return (
    <div className="hero-graffiti" aria-hidden="true">
      <div className="graffiti-scout">
        <span>
          just browsing
          <br />
          the human internet.
        </span>
        <AgentDoodle />
        <Scribble />
      </div>
      <div className="graffiti-reader">
        <span>
          came for the docs.
          <br />
          stayed for the details.
        </span>
        <AgentDoodle kind="reader" />
      </div>
      <span className="graffiti-tag graffiti-tag-request">GET /hello</span>
      <span className="graffiti-tag graffiti-tag-bots">
        humans welcome.
        <br />
        bots too.
      </span>
      <svg className="hero-ink-trail" viewBox="0 0 1400 550" fill="none" preserveAspectRatio="none">
        <g stroke="#bd7590" strokeWidth="1.5" strokeLinecap="round">
          <path d="M60 330c100 75 150-75 210-10s-20 150 80 155" strokeDasharray="3 9" />
          <path d="M1315 380c-120 35-110 110-250 95" strokeDasharray="3 9" />
          <path d="m1230 80 10-20 7 19 20 6-20 9-7 20-8-20-22-7z" />
          <path d="m221 58 7-12 4 12 13 5-13 4-5 12-6-12-11-3z" />
        </g>
      </svg>
    </div>
  );
}
