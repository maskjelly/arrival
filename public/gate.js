const context = JSON.parse(document.getElementById('arrival-context').textContent);
document.getElementById('check-in-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button'),
    error = document.getElementById('form-error');
  const form = new FormData(event.currentTarget),
    answers = {};
  document.querySelectorAll('[data-error]').forEach((el) => (el.textContent = ''));
  for (const q of context.questions)
    answers[q.id] =
      q.type === 'multiselect' ? form.getAll(q.id) : String(form.get(q.id) || '').trim();
  button.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch('/api/agent/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: context.token, answers }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.fields)
        for (const [key, message] of Object.entries(data.fields)) {
          const el = document.querySelector(`[data-error="${CSS.escape(key)}"]`);
          if (el) el.textContent = message;
        }
      throw new Error(data.error || 'Check-in could not be completed.');
    }
    location.assign(context.returnTo);
  } catch (err) {
    error.textContent = err.message;
    button.disabled = false;
  }
});
