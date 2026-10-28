import { ArrowRight, Globe, Path } from '@phosphor-icons/react';
import { AgentDoodle } from './AgentGraffiti.tsx';
import { ClientMark } from './ClientMark.tsx';
export default function AgentMap() {
  return (
    <section className="agent-map-section" aria-labelledby="agent-map-title">
      <div className="agent-map-heading">
        <span className="handwritten">Different visitors. One front door.</span>
        <h2 id="agent-map-title">
          A whole little internet
          <br />
          is finding its way to you.
        </h2>
        <p>
          The reader. The researcher. The custom-built crawler. Arrival makes room for their visit,
          and gives you a trail to follow.
        </p>
      </div>
      <div className="agent-map-canvas">
        <svg
          className="agent-map-wires"
          viewBox="0 0 1200 580"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <g stroke="#c39aa9" strokeWidth="2">
            <path d="M220 118h100q25 0 25 25v95q0 25 25 25h110M220 290h260M220 460h100q25 0 25-25V330q0-25 25-25h110M700 280h105q25 0 25-25v-70q0-25 25-25h120M700 315h105q25 0 25 25v100q0 25 25 25h120" />
            <path d="M594 360v150q0 25 25 25h110" strokeDasharray="5 8" />
          </g>
          <g fill="#faf6f4" stroke="#ad315a" strokeWidth="2">
            <circle cx="345" cy="290" r="5" />
            <circle cx="830" cy="280" r="5" />
          </g>
        </svg>
        <div className="agent-map-visitors">
          <div className="map-visitor">
            <ClientMark name="ChatGPT-User" size={24} />
            <div>
              <strong>The researcher</strong>
              <span>“What’s on this page?”</span>
            </div>
            <span className="map-visitor-note">read & go</span>
          </div>
          <div className="map-visitor">
            <ClientMark name="Claude-User" size={24} />
            <div>
              <strong>The reader</strong>
              <span>“Let me take a closer look.”</span>
            </div>
            <span className="map-visitor-note">curious one</span>
          </div>
          <div className="map-visitor">
            <ClientMark name="Custom agent" size={24} />
            <div>
              <strong>Your own kind of agent</strong>
              <span>A browser, a script, a little side project.</span>
            </div>
            <span className="map-visitor-note">hello, you</span>
          </div>
        </div>
        <div className="map-arrival-hub">
          <span className="map-postmark">a little context goes a long way</span>
          <span className="map-hub-icon">
            <Path size={46} weight="light" />
          </span>
          <strong>arrival</strong>
          <span>
            See the visit.
            <br />
            Keep the task moving.
          </span>
          <div className="map-hub-stitches" />
        </div>
        <div className="agent-map-destinations">
          <article className="map-website">
            <div>
              <Globe size={17} />
              <span>Your website</span>
              <span className="map-window-dots">•••</span>
            </div>
            <h3>
              Right where
              <br />
              they meant to be.
            </h3>
            <div className="map-page-chips">
              <span>/pricing</span>
              <span>/docs</span>
              <span>/projects</span>
            </div>
            <p>HTTP fetchers read freely. Interactive browser agents can meet your questions.</p>
          </article>
          <article className="map-visit-slip">
            <span>What the visit leaves behind</span>
            <dl>
              <div>
                <dt>Who</dt>
                <dd>Client & signals</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>Connection origin</dd>
              </div>
              <div>
                <dt>What next</dt>
                <dd>The pages they visit</dd>
              </div>
            </dl>
            <span className="map-slip-note">The why? Only when they share it.</span>
          </article>
        </div>
        <div className="map-courier">
          <AgentDoodle kind="courier" />
          <span>
            following the
            <br />
            little breadcrumbs.
          </span>
        </div>
      </div>
      <div className="agent-map-footer">
        <p>Illustrative visitors. Client names are claims, not verified identities.</p>
        <a className="m-text-link" href="#experience">
          Follow an example <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}
