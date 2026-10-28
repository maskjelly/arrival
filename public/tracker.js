(() => {
  const script = document.currentScript;
  if (!script?.src) return;
  const siteId = script.dataset.site;
  const external = !!siteId;
  // Browser-reported automation can request the same server introduction used by HTTP agents.
  // This is a cooperative signal, not proof or an anti-spoofing boundary.
  if (
    external &&
    script.dataset.entry === 'ask' &&
    navigator.webdriver &&
    !document.cookie.split(';').some((c) => c.trim() === 'arrival_introduced=1')
  ) {
    const destination = new URL(location.href);
    if (!destination.searchParams.has('__arrival_browser')) {
      destination.searchParams.set('__arrival_browser', '1');
      location.replace(destination.href);
      return;
    }
  }

  if (window.arrival?.siteId === (siteId || 'gateway')) return;
  const server = new URL(script.src, location.href).origin;
  const checkInMode = script.dataset.checkIn || 'agents';
  const storageKey = `arrival:${server}:${siteId || 'gateway'}`;
  const context = external
    ? {}
    : JSON.parse(document.getElementById('arrival-context')?.textContent || '{}');
  let token = '',
    questions = [],
    answered = false,
    dismissed = false,
    disabled = false;
  let panel,
    lastDepth = 0,
    lastPath = location.pathname;
  try {
    if (external) token = sessionStorage.getItem(storageKey) || '';
    dismissed = sessionStorage.getItem(storageKey + ':dismissed') === '1';
  } catch {
    /* Storage is optional. */
  }
  const environment = {
    userAgent: navigator.userAgent.slice(0, 700),
    webdriver: !!navigator.webdriver,
    language: navigator.language,
    languages: [...navigator.languages].slice(0, 10),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    viewport: `${innerWidth} × ${innerHeight}`,
    screen: `${screen.width} × ${screen.height}`,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    ...(typeof navigator.deviceMemory === 'number' ? { deviceMemory: navigator.deviceMemory } : {}),
    touchPoints: navigator.maxTouchPoints || 0,
    cookiesEnabled: navigator.cookieEnabled,
    colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    pixelRatio: devicePixelRatio || 1,
    colorDepth: screen.colorDepth || 0,
    ...(navigator.userAgentData
      ? {
          browserBrands: navigator.userAgentData.brands
            .slice(0, 10)
            .map((b) => `${b.brand} ${b.version}`),
          mobile: !!navigator.userAgentData.mobile,
        }
      : {}),
    ...(navigator.connection
      ? {
          connectionType: String(navigator.connection.effectiveType || '').slice(0, 40),
          ...(Number.isFinite(navigator.connection.downlink)
            ? { downlinkMbps: navigator.connection.downlink }
            : {}),
          ...(Number.isFinite(navigator.connection.rtt)
            ? { roundTripMs: navigator.connection.rtt }
            : {}),
          saveData: !!navigator.connection.saveData,
        }
      : {}),
    ...(navigator.doNotTrack ? { doNotTrack: String(navigator.doNotTrack).slice(0, 20) } : {}),
    ...(typeof navigator.globalPrivacyControl === 'boolean'
      ? { globalPrivacyControl: navigator.globalPrivacyControl }
      : {}),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
  const endpoint = '/api/collect/' + encodeURIComponent(siteId || '');
  const send = async (payload, path) => {
    if (disabled) return;
    try {
      const response = await fetch(server + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(external && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: external ? 'omit' : 'same-origin',
        // The first hosted request may initialize the function and local IP readers.
        signal: AbortSignal.timeout(payload.type === 'start' ? 10000 : 4000),
      });
      const data = await response.json().catch(() => ({}));
      return response.ok ? data : { error: data.error || 'Could not save this response.' };
    } catch {
      return { error: 'Check-in is unavailable. You can keep browsing.' };
    }
  };
  const suspected =
    environment.webdriver || /bot|agent|headless|playwright|puppeteer/i.test(environment.userAgent);
  const linkBrowserSession = async () => {
    if (!external || script.dataset.entry !== 'ask') return;
    // The host issues a short-lived, visit-only token. No integration key reaches the browser.
    try {
      const response = await fetch(
        '/__arrival/browser-session?path=' + encodeURIComponent(location.pathname),
        { credentials: 'same-origin', signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw new Error('Session linking unavailable');
      const data = await response.json();
      if (!data.token) throw new Error('Missing visit token');
      token = data.token;
    } catch {
      // Avoid counting a second visit when the host integration is temporarily unavailable.
      disabled = true;
    }
  };
  const ready = linkBrowserSession()
    .then(() =>
      external
        ? send(
            { type: 'start', path: location.pathname, referrer: document.referrer, environment },
            endpoint,
          )
        : send(environment, '/api/agent/environment'),
    )
    .then((data) => {
      if (data?.sessionToken) {
        token = data.sessionToken;
        try {
          sessionStorage.setItem(storageKey, token);
        } catch {}
      }
      questions = external
        ? data?.questions || []
        : context.optional
          ? context.questions || []
          : [];
      answered = external ? !!data?.answered : !!context.answered;
      if (
        questions.length &&
        !answered &&
        !dismissed &&
        (checkInMode === 'all' || (checkInMode === 'agents' && suspected))
      )
        showCheckIn();
      document.dispatchEvent(new CustomEvent('arrival:ready', { detail: { ok: !data?.error } }));
      return { ok: !!data && !data.error };
    });
  const event = async (type, details = {}) => {
    await ready;
    const data = { id: crypto.randomUUID(), type, path: location.pathname, ...details };
    return external
      ? send({ type: 'event', path: location.pathname, event: data }, endpoint)
      : send(data, '/api/agent/events');
  };
  const identify = async (answers) => {
    await ready;
    const result = external
      ? await send({ type: 'check_in', path: location.pathname, answers }, endpoint)
      : await send({ sessionToken: context.token, answers }, '/api/agent/check-in');
    if (result?.ok) {
      answered = true;
      panel?.remove();
      panel = undefined;
    }
    return result;
  };
  window.arrival = {
    siteId: siteId || 'gateway',
    ready,
    identify,
    checkIn: async () => {
      await ready;
      return showCheckIn(true);
    },
    track: (label) => event('click', { label: String(label).slice(0, 180) }),
    disable: () => {
      disabled = true;
      panel?.remove();
    },
  };
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target.closest?.('[data-arrival-track], [data-action]');
      if (target)
        void event('click', {
          label: String(target.dataset.arrivalTrack || target.dataset.action).slice(0, 180),
        });
    },
    { passive: true },
  );
  addEventListener(
    'scroll',
    () => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      if (maximum <= 0) return;
      const depth = Math.min(100, Math.floor(((scrollY / maximum) * 100) / 25) * 25);
      if (depth > lastDepth) {
        lastDepth = depth;
        void event('scroll', { depth });
      }
    },
    { passive: true },
  );
  document.addEventListener(
    'visibilitychange',
    () => void event('visibility', { state: document.visibilityState }),
  );
  const navigate = () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    lastDepth = 0;
    void event('page_view');
  };
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      navigate();
      return result;
    };
  }
  addEventListener('popstate', navigate);
  function showCheckIn(expand = false) {
    if (disabled || answered || !questions.length) return false;
    if (panel) {
      if (expand) panel.shadowRoot.querySelector('details').open = true;
      return true;
    }
    panel = document.createElement('div');
    panel.setAttribute('data-arrival-check-in', '');
    const shadow = panel.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{position:fixed;right:16px;bottom:16px;z-index:2147483000;max-width:calc(100vw - 32px);color-scheme:light}*{box-sizing:border-box}details{width:360px;max-width:calc(100vw - 32px);border:1px solid #dbe3f0;border-radius:9px;background:#fff;color:#25334b;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 32px #1e34551c}summary{cursor:pointer;padding:16px 18px;font-size:12px;font-weight:600;color:#45629a}section{max-height:65dvh;overflow:auto;padding:0 22px 22px}p,small{color:#586d8c;font-size:12px}label,legend{display:block;font-size:12px;font-weight:600;margin:15px 0 6px}input:not([type=checkbox]),textarea,select{display:block;width:100%;font:inherit;padding:9px;border:1px solid #ccd8ec;border-radius:5px;background:white;color:#25334b}textarea{min-height:70px}input[type=checkbox]{accent-color:#355bd8}fieldset{border:0;padding:0;margin:0}.option{display:flex;align-items:center;gap:8px;font-weight:400;margin:7px 0}button{font:inherit;cursor:pointer;border:1px solid #355bd8;border-radius:5px;padding:9px 13px;background:#355bd8;color:white;font-size:12px}button:disabled{opacity:.5}.skip{background:#fff;border-color:#d4deee;color:#536b93}.actions{display:flex;gap:9px;margin:20px 0 10px}[role=alert]{color:#a33b53}*:focus-visible{outline:2px solid #355bd8;outline-offset:3px}`;
    const details = document.createElement('details');
    details.open = expand;
    const summary = document.createElement('summary');
    summary.textContent = 'Share your task (optional)';
    const section = document.createElement('section');
    section.setAttribute('aria-label', 'Optional agent check-in');
    const intro = document.createElement('p');
    intro.textContent =
      'This website stays available. Help its owner understand your task by answering these optional check-in questions. Share a summary, never private prompts or personal details.';
    const form = document.createElement('form');
    for (const q of questions) {
      if (q.type === 'multiselect') {
        const group = document.createElement('fieldset'),
          legend = document.createElement('legend');
        legend.textContent = q.label + (q.required ? ' *' : '');
        group.append(legend);
        for (const option of q.options) {
          const label = document.createElement('label'),
            input = document.createElement('input');
          label.className = 'option';
          input.type = 'checkbox';
          input.name = q.id;
          input.value = option;
          label.append(input, document.createTextNode(option));
          group.append(label);
        }
        form.append(group);
        continue;
      }
      const label = document.createElement('label');
      label.htmlFor = 'arrival-' + q.id;
      label.textContent = q.label + (q.required ? ' *' : '');
      const input = document.createElement(
        q.type === 'textarea' ? 'textarea' : q.type === 'select' ? 'select' : 'input',
      );
      input.id = 'arrival-' + q.id;
      input.name = q.id;
      input.required = q.required;
      if (q.type === 'select')
        for (const value of ['', ...q.options]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value || 'Choose one';
          input.append(option);
        }
      else input.maxLength = 2000;
      form.append(label, input);
    }
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Share task';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'skip';
    skip.textContent = 'Skip';
    skip.onclick = () => {
      dismissed = true;
      try {
        sessionStorage.setItem(storageKey + ':dismissed', '1');
      } catch {}
      panel?.remove();
      panel = undefined;
    };
    actions.append(submit, skip);
    const note = document.createElement('small');
    note.textContent =
      'Arrival · Optional analytics. Required fields only apply if you choose to share.';
    form.append(error, actions);
    section.append(intro, form, note);
    details.append(summary, section);
    shadow.append(style, details);
    document.body.append(panel);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      error.textContent = '';
      const fields = new FormData(form),
        answers = {};
      for (const q of questions)
        answers[q.id] =
          q.type === 'multiselect' ? fields.getAll(q.id) : String(fields.get(q.id) || '').trim();
      const result = await identify(answers);
      if (!result?.ok) {
        error.textContent = result?.error || 'You can keep browsing without sharing.';
        submit.disabled = false;
      }
    });
    return true;
  }
})();
