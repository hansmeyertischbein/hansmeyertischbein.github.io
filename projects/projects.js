// Topic filter for the projects feed
const chips = document.querySelectorAll('.chip');
const entries = document.querySelectorAll('.entry');
const months = document.querySelectorAll('.feed-month');
const empty = document.querySelector('.feed-empty');

function apply(topic) {
  chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.filter === topic)));
  entries.forEach(e => { e.hidden = topic !== 'all' && e.dataset.topic !== topic; });
  let shown = 0;
  months.forEach(m => {
    const visible = m.querySelectorAll('.entry:not([hidden])').length;
    m.hidden = visible === 0;
    shown += visible;
  });
  empty.hidden = shown > 0;
}

chips.forEach(c => c.addEventListener('click', () => {
  const topic = c.dataset.filter;
  apply(topic);
  // Keep the choice in the URL so a shared link opens the same filter
  history.replaceState(null, '', topic === 'all' ? location.pathname : `#${topic}`);
}));

const initial = location.hash.slice(1);
if ([...chips].some(c => c.dataset.filter === initial)) apply(initial);
