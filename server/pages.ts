import type { Question, Visit } from '../src/types.ts';
import { htmlEscape as e, jsonScript } from './signals.ts';

const style = `*{box-sizing:border-box}body{margin:0;background:#f4f7f9;color:#183342;font:15px/1.6 system-ui,sans-serif}a{color:#126b69;text-underline-offset:4px}button,input,textarea,select{font:inherit}button,a,input,textarea,select{outline-offset:4px}button{cursor:pointer;background:#196b66;color:white;border:0;border-radius:8px;padding:11px 18px;font-weight:600}button:disabled{opacity:.5;cursor:wait}header{background:#fff;border-bottom:1px solid #dfe6eb;padding:18px max(24px,calc((100% - 1040px)/2));display:flex;align-items:center;justify-content:space-between;gap:20px}header strong{font-size:19px;letter-spacing:-.6px}header nav{display:flex;gap:20px;flex-wrap:wrap}main{max-width:1040px;margin:64px auto;padding:0 24px}h1{font-size:clamp(32px,5vw,48px);line-height:1.13;letter-spacing:-1.8px;max-width:720px}h2{font-size:24px;letter-spacing:-.6px}p{max-width:680px;color:#576d79}.gate{max-width:600px;margin:38px auto;background:#fff;border:1px solid #dfe6eb;border-radius:16px;padding:32px}.gate h1{font-size:30px;letter-spacing:-1px;margin-top:8px}.tag{font-size:12px;color:#196b66;background:#e6f3ef;padding:5px 9px;border-radius:5px}label,.field-title{display:block;font-size:14px;font-weight:600;margin:20px 0 7px}input:not([type=checkbox]),textarea,select{display:block;width:100%;padding:11px 12px;border:1px solid #ccd6dd;border-radius:7px;background:white;color:#183342}textarea{min-height:90px;resize:vertical}.check{display:flex;align-items:center;gap:9px;margin:9px 0;font-weight:400}.error{color:#ac3543;font-size:13px}.small{font-size:12px;color:#657984}.actions{margin-top:25px;display:flex;align-items:center;gap:20px}.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:36px 0}.tile{background:white;border:1px solid #dce5ea;border-radius:12px;padding:24px}.tile p{font-size:14px}.price{font-size:36px;font-weight:650;letter-spacing:-1.5px}.result{background:white;padding:14px 18px;border:1px solid #dce5ea;border-radius:8px;margin:8px 0}.code{padding:24px;background:#193647;color:#dbe9ed;border-radius:10px;overflow:auto;font:13px/1.8 monospace}.note{border-left:3px solid #196b66;padding:4px 18px;margin:30px 0}.notice{background:#e8f3ef;padding:15px;border-radius:9px}.lab-footer{margin:70px 0 25px;border-top:1px solid #dce5ea;padding-top:20px;font-size:12px;color:#657984}@media(max-width:650px){header{padding:16px;align-items:flex-start;flex-direction:column}header nav{font-size:13px;gap:14px}main{margin:30px auto;padding:0 16px}.gate{padding:24px;margin:20px 16px}.tiles{grid-template-columns:1fr}.actions{align-items:stretch;flex-direction:column}}`;
function shell(title: string, body: string, script: string, context: unknown = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)} · Northstar</title><style>${style}</style><link rel="stylesheet" href="/gate-fabric.css"><link rel="icon" type="image/svg+xml" href="/favicon.svg"></head><body>${body}<script type="application/json" id="arrival-context">${jsonScript(context)}</script><script src="/tracker.js" defer></script>${script ? `<script src="/${script}.js" defer></script>` : ''}</body></html>`;
}
function field(q: Question) {
  const label = `${e(q.label)}${q.required ? ' <span aria-label="required">*</span>' : ''}`;
  const required = q.required ? 'required' : '';
  if (q.type === 'multiselect')
    return `<fieldset style="border:0;padding:0;margin:20px 0"><legend class="field-title">${label}</legend>${q.options.map((o) => `<label class="check"><input type="checkbox" name="${e(q.id)}" value="${e(o)}">${e(o)}</label>`).join('')}<p class="error" data-error="${e(q.id)}"></p></fieldset>`;
  const control =
    q.type === 'textarea'
      ? `<textarea id="${e(q.id)}" name="${e(q.id)}" maxlength="2000" ${required}></textarea>`
      : q.type === 'select'
        ? `<select id="${e(q.id)}" name="${e(q.id)}" ${required}><option value="">Choose one</option>${q.options.map((o) => `<option>${e(o)}</option>`).join('')}</select>`
        : `<input id="${e(q.id)}" name="${e(q.id)}" maxlength="2000" autocomplete="off" ${required}>`;
  return `<label for="${e(q.id)}">${label}</label>${control}<p class="error" data-error="${e(q.id)}"></p>`;
}
export function gatePage(visit: Visit, token: string) {
  return shell(
    'Agent check-in',
    `<header><strong>Northstar</strong><a href="/app">Arrival dashboard</a></header><main class="gate"><span class="tag">Agent check-in</span><h1>Tell us what brings you here.</h1><p>Declare your task to access this demonstration website. Your answers will be linked to activity on this site.</p><p class="small">Share a short task summary. Do not include passwords, personal details, or your user's full private prompt. Answers are self-reported.</p><form id="check-in-form">${visit.questions.map(field).join('')}<p class="error" id="form-error" role="alert"></p><div class="actions"><button type="submit">Declare purpose & continue</button><span class="small">Read-only access · 1 hour</span></div></form><p class="small" style="margin-top:24px">Every visitor checks in on this demo. This page is not evidence that an AI agent was detected.</p></main>`,
    'gate',
    {
      token,
      questions: visit.questions,
      returnTo: visit.entryPath.startsWith('/lab') ? visit.entryPath : '/lab',
    },
  );
}
export const catalog = [
  {
    path: '/lab/docs',
    title: 'API documentation',
    text: 'REST API, authentication, quickstart and SDK integration.',
  },
  {
    path: '/lab/pricing',
    title: 'Plans and pricing',
    text: 'Free developer plan, team collaboration, enterprise data controls.',
  },
  {
    path: '/lab/integrations',
    title: 'Integrations',
    text: 'Node.js, Python, webhooks and data warehouse connectors.',
  },
  {
    path: '/lab/security',
    title: 'Security and data handling',
    text: 'Encryption, isolated projects, retention and export controls.',
  },
];
export function labPage(path: string, visit: Visit) {
  const body =
    path === '/lab/pricing'
      ? `<h1>Start small. Grow with your team.</h1><p>Sample plans for the Northstar demonstration product.</p><div class="tiles"><article class="tile"><h2>Developer</h2><div class="price">$0</div><p>One workspace. 10,000 API requests per month. Community support.</p></article><article class="tile"><h2>Team</h2><div class="price">$49<span class="small"> / month</span></div><p>Unlimited workspaces. 500,000 requests. Shared access and webhooks.</p></article><article class="tile"><h2>Enterprise</h2><div class="price">Custom</div><p>Private deployment. SSO. Dedicated retention and access controls.</p></article></div><button data-action="shortlist">Save Team to shortlist</button><p id="action-result" role="status"></p>`
      : path === '/lab/docs'
        ? `<h1>A small API. A clear starting point.</h1><p>Northstar is a fictional data API for testing agent research. Start by creating a workspace, then authenticate each request with a scoped API key.</p><pre class="code">GET /v1/workspaces\nAuthorization: Bearer YOUR_API_KEY\n\n{ "data": [], "has_more": false }</pre><h2>Quickstart</h2><p>The SDK supports Node.js and Python. Requests are paginated, with a maximum of 100 results per page. Use the retry-after header when rate limited.</p><a href="/lab/download/specification.json" data-arrival-track="Download API specification">Download API specification</a>`
        : path === '/lab/integrations'
          ? `<h1>Connect to the tools you already use.</h1><p>Explore the sample integrations below, then search the documentation for details.</p><div class="tiles"><article class="tile"><h2>Node.js</h2><p>A typed client with pagination, retries and streaming responses.</p></article><article class="tile"><h2>Python</h2><p>A small synchronous and asynchronous API client.</p></article><article class="tile"><h2>Webhooks</h2><p>Signed notifications, retry delivery and event history.</p></article></div><a href="/lab/docs">Read the API documentation</a>`
          : path === '/lab/security'
            ? `<h1>Know what happens to your data.</h1><p>These are sample product details, not security certifications.</p><h2>Project isolation</h2><p>Each workspace uses separate access keys and permission boundaries. Rotate keys without recreating a workspace.</p><h2>Retention and export</h2><p>Choose a retention period and export workspace records as JSON. Enterprise plans offer private deployment.</p>`
            : `<span class="tag">Arrival's instrumented demo website</span><h1>A better starting point for your next integration.</h1><p>Explore this fictional product as an agent would. Page requests and actions appear in your Arrival session timeline.</p><div class="notice">Access granted for this visit. Your declared purpose and the activity below are stored separately.</div><div class="tiles">${catalog
                .slice(0, 3)
                .map(
                  (c) =>
                    `<article class="tile"><h2>${e(c.title)}</h2><p>${e(c.text)}</p><a href="${e(c.path)}">Explore ${e(c.title.toLowerCase())}</a></article>`,
                )
                .join(
                  '',
                )}</div><h2>Find an answer</h2><form id="search-form"><label for="search">Search the demo website</label><div style="display:flex;gap:10px"><input id="search" name="query" placeholder="Try pricing, Python, or security" maxlength="120"><button>Search</button></div></form><div id="search-results" aria-live="polite"></div>`;
  return shell(
    catalog.find((c) => c.path === path)?.title ?? 'Explore Northstar',
    `<header><strong>Northstar</strong><nav><a href="/lab">Overview</a><a href="/lab/docs">Documentation</a><a href="/lab/pricing">Pricing</a><a href="/lab/integrations">Integrations</a><a href="/app">Arrival dashboard</a></nav></header><main>${body}<footer class="lab-footer">Controlled demonstration website · Session ${e(visit.id.slice(0, 8))} · All prices and product details are sample content.</footer></main>`,
    'lab',
  );
}
