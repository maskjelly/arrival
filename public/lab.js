document.getElementById('search-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const target = document.getElementById('search-results');
  target.textContent = 'Searching…';
  try {
    const response = await fetch(
      '/api/lab/search?q=' + encodeURIComponent(new FormData(event.currentTarget).get('query')),
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search is unavailable.');
    target.replaceChildren();
    for (const result of data.results) {
      const div = document.createElement('div');
      div.className = 'result';
      const link = document.createElement('a');
      link.href = result.path;
      link.textContent = result.title;
      div.append(link);
      target.append(div);
    }
    if (!data.results.length) target.textContent = 'No matching pages.';
  } catch (error) {
    target.textContent = error.message;
  }
});
document.querySelector('[data-action="shortlist"]')?.addEventListener('click', async () => {
  const target = document.getElementById('action-result');
  try {
    const response = await fetch('/api/lab/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'Team' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save this plan.');
    target.textContent = 'Team added to this session’s shortlist. No purchase was made.';
  } catch (error) {
    target.textContent = error.message;
  }
});
