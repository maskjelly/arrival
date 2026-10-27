(() => {
  const script = document.currentScript;
  const siteId = script?.dataset.site;
  const server = new URL(script.src, location.href).origin;
  const external = !!siteId;
  const checkInMode = script?.dataset.checkIn || 'off';
  const storageKey = `arrival:${server}:${siteId}`;
  let token = '';
  try {
    if (external) token = sessionStorage.getItem(storageKey) || '';
  } catch {
    /* tracking works without persistent storage */
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
  };
  const send = async (payload, endpoint) => {
    try {
      const response = await fetch(server + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(external && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: external ? 'omit' : 'same-origin',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { error: error.error || 'Could not save this response.' };
      }
      return await response.json();
    } catch {
      /* Analytics failure must not break the host website. */
    }
  };
  const start = external
    ? send(
        { type: 'start', path: location.pathname, referrer: document.referrer, environment },
        '/api/collect/' + encodeURIComponent(siteId),
      ).then((data) => {
        if (data?.sessionToken) {
          token = data.sessionToken;
          try {
            sessionStorage.setItem(storageKey, token);
          } catch {}
        }
        const suspected =
          environment.webdriver ||
          /bot|agent|headless|playwright|puppeteer/i.test(environment.userAgent);
        if (
          data?.questions &&
          !data.answered &&
          (checkInMode === 'all' || (checkInMode === 'agents' && suspected))
        )
          showCheckIn(data.questions);
      })
    : send(environment, '/api/agent/environment');
  const event = async (type, details = {}) => {
    await start;
    const data = { id: crypto.randomUUID(), type, path: location.pathname, ...details };
    if (external)
      await send(
        { type: 'event', path: location.pathname, event: data },
        '/api/collect/' + encodeURIComponent(siteId),
      );
    else await send(data, '/api/agent/events');
  };
  // Only explicitly annotated controls are recorded. Input values and page text are never captured.
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target.closest?.('[data-arrival-track], [data-action]');
      if (target)
        event('click', {
          label: String(target.dataset.arrivalTrack || target.dataset.action).slice(0, 180),
        });
    },
    { passive: true },
  );
  let lastDepth = 0;
  addEventListener(
    'scroll',
    () => {
      const maximum = document.documentElement.scrollHeight - innerHeight;
      if (maximum <= 0) return;
      const depth = Math.min(100, Math.floor(((scrollY / maximum) * 100) / 25) * 25);
      if (depth > lastDepth) {
        lastDepth = depth;
        event('scroll', { depth });
      }
    },
    { passive: true },
  );
  document.addEventListener('visibilitychange', () =>
    event('visibility', { state: document.visibilityState === 'visible' ? 'visible' : 'hidden' }),
  );
  function showCheckIn(questions) {
    const host = document.createElement('div');
    host.setAttribute('data-arrival-check-in', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `dialog{box-sizing:border-box;border:1px solid #e9c6d9;border-radius:16px;padding:28px;max-width:500px;width:calc(100% - 32px);max-height:85dvh;color:#4d2a3e;background:white;font:14px/1.6 system-ui,sans-serif;box-shadow:0 20px 80px #15334230}dialog::backdrop{background:#4d2a3e50}h2{font-size:25px;letter-spacing:-.7px;line-height:1.2;margin:0 0 12px}p{font-size:12px;color:#ab7e96}label,legend{display:block;font-size:12px;font-weight:600;margin:16px 0 7px}input:not([type=checkbox]),textarea,select{box-sizing:border-box;width:100%;font:inherit;font-size:13px;padding:10px;border:1px solid #e8c8d8;border-radius:6px;background:white;color:#4d2a3e}textarea{min-height:75px}fieldset{border:0;padding:0}.option{display:flex;align-items:center;gap:8px;font-weight:400;margin:7px 0}button{font:inherit;cursor:pointer;border:0;border-radius:7px;padding:10px 15px;background:#2d1b27;color:#fff;font-size:12px}button:disabled{opacity:.5}.skip{background:#ffe3f0;color:#ad7894}.actions{display:flex;gap:10px;margin-top:22px}#error{color:#b14e81;font-size:12px}small{display:block;font-size:10px;color:#ba94a8;margin-top:17px}*:focus-visible{outline:2px solid #b65388;outline-offset:3px}dialog::before{content:"";position:absolute;inset:7px;border:1px dashed #e7b7d0;border-radius:10px;pointer-events:none}dialog{position:fixed;background:#fff8fc;border-color:#e4bad0;box-shadow:0 8px 0 -4px #d9a5bd,0 20px 80px #421c3433}button{position:relative;padding:14px 18px}button::after{content:"";position:absolute;inset:4px;border:1px dashed #d4a1bc88;border-radius:4px;pointer-events:none}.skip{border:1px solid #e5bad0;color:#9d6080}`;
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label', 'Optional agent check-in');
    const title = document.createElement('h2');
    title.textContent = 'What brings you here?';
    const intro = document.createElement('p');
    intro.textContent =
      'Help this website understand your task. Your answers will be linked to this visit. Share a summary, not private prompts or personal details.';
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
      if (q.type === 'select') {
        for (const value of ['', ...q.options]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value || 'Choose one';
          input.append(option);
        }
      } else {
        input.maxLength = 2000;
      }
      form.append(label, input);
    }
    const error = document.createElement('p');
    error.id = 'error';
    error.setAttribute('role', 'alert');
    const actions = document.createElement('div');
    actions.className = 'actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Share task & continue';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'skip';
    skip.textContent = 'Skip for now';
    skip.onclick = () => dialog.close();
    actions.append(submit, skip);
    const note = document.createElement('small');
    note.textContent =
      'Optional check-in powered by Arrival. This prompt does not verify identity or enforce website access.';
    form.append(error, actions);
    dialog.append(title, intro, form, note);
    shadow.append(style, dialog);
    document.body.append(host);
    dialog.addEventListener('close', () => host.remove());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      error.textContent = '';
      const fields = new FormData(form),
        answers = {};
      for (const q of questions)
        answers[q.id] =
          q.type === 'multiselect' ? fields.getAll(q.id) : String(fields.get(q.id) || '').trim();
      const result = await send(
        { type: 'check_in', path: location.pathname, answers },
        '/api/collect/' + encodeURIComponent(siteId),
      );
      if (!result?.ok) {
        error.textContent = result?.error || 'Could not save these answers. Try again.';
        submit.disabled = false;
      } else dialog.close();
    });
    dialog.showModal();
  }
})();
