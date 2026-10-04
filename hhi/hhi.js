// Market concentration calculator (Herfindahl–Hirschman Index)
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/hhi/

/* ---------- Calculations ---------- */

// HHI = sum of squared market shares in percent (0–10,000)
function hhi(shares) {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

// Change in HHI when two companies with shares a and b merge:
// (a + b)^2 - a^2 - b^2 = 2ab
function mergerDelta(a, b) {
  return 2 * a * b;
}

// Number of equally sized companies that would give the same HHI
function equivalentFirms(h) {
  return h > 0 ? 10000 / h : 0;
}

function classify(h) {
  if (h <= 0) return { label: 'Add companies to start', band: 'none' };
  if (h < 1000) return { label: 'Unconcentrated market', band: 'low', word: 'unconcentrated' };
  if (h <= 1800) return { label: 'Moderately concentrated market', band: 'mid', word: 'moderately concentrated' };
  return { label: 'Highly concentrated market', band: 'high', word: 'highly concentrated' };
}

/* ---------- Example data ---------- */

// Norwegian non-life insurance, share of premiums in force, Q3 2025 (Finans Norge)
const NORWAY_NONLIFE_Q3_2025 = [
  ['Gjensidige', 26.3], ['If', 20.6], ['Fremtind', 18.6], ['Tryg', 12.5],
  ['Storebrand', 5.7], ['Frende Forsikring', 3.7], ['KLP', 2.5], ['Protector', 1.9],
  ['JBF Forsikring Gjensidig', 1.6], ['DNB Liv', 1.5], ['Landkreditt Forsikring', 1.1],
  ['WaterCircles Forsikring', 0.8], ['Ergo', 0.6], ['KNIF Trygghet Forsikring', 0.6],
  ['Ly Forsikring', 0.6], ['Ayvens', 0.3], ['Euro Accident', 0.3], ['Nordea', 0.3],
  ['Eir Försäkring', 0.2], ['Oslo Forsikring', 0.2], ['Gar-Bo Försäkring', 0.1],
  ['YouPlus Livsforsikring', 0.1]
];

/* ---------- State ---------- */

let firms = []; // { id, name, share }
let nextId = 1;

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const el = id => document.getElementById(id);
const shareOf = f => (Number.isFinite(f.share) && f.share > 0 ? f.share : 0);
const nameOf = (f, i) => f.name.trim() || `Company ${i + 1}`;

/* ---------- Rendering ---------- */

const removeIcon = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg>';

function renderRows(focusId) {
  const list = el('firms');
  list.innerHTML = '';
  firms.forEach((f, i) => {
    const li = document.createElement('li');
    li.className = 'firm';
    li.dataset.id = f.id;

    const name = document.createElement('input');
    name.className = 'field f-name';
    name.type = 'text';
    name.value = f.name;
    name.placeholder = `Company ${i + 1}`;
    name.setAttribute('aria-label', `Name of company ${i + 1}`);
    name.addEventListener('input', () => { f.name = name.value; update(); });

    const share = document.createElement('input');
    share.className = 'field f-share';
    share.type = 'number';
    share.inputMode = 'decimal';
    share.min = '0';
    share.max = '100';
    share.step = '0.1';
    share.value = Number.isFinite(f.share) ? f.share : '';
    share.placeholder = '0';
    share.setAttribute('aria-label', `Market share of ${nameOf(f, i)} in percent`);
    share.addEventListener('input', () => { f.share = parseFloat(share.value.replace(',', '.')); update(); });

    const contrib = document.createElement('div');
    contrib.className = 'contrib';
    contrib.innerHTML = '<span class="contrib-bar"></span><span class="contrib-val"></span>';

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-quiet remove';
    rm.innerHTML = removeIcon;
    rm.setAttribute('aria-label', `Remove ${nameOf(f, i)}`);
    rm.addEventListener('click', () => {
      firms = firms.filter(x => x.id !== f.id);
      renderRows();
      update();
    });

    li.append(name, share, contrib, rm);
    list.append(li);
    if (f.id === focusId) name.focus();
  });
}

function update() {
  const shares = firms.map(shareOf);
  const h = hhi(shares);
  const cls = classify(h);
  const total = shares.reduce((a, b) => a + b, 0);
  const maxContrib = Math.max(...shares.map(s => s * s), 1);

  // Result
  el('hhi-value').textContent = fmt(Math.round(h));
  el('hhi-label').textContent = cls.label;
  el('marker').style.left = `${Math.min(h, 3000) / 3000 * 100}%`;
  el('peek-value').textContent = fmt(Math.round(h));
  el('peek-label').textContent = cls.band === 'none' ? '' : cls.label;

  const counted = shares.filter(s => s > 0).length;
  el('hhi-note').textContent = h > 0
    ? `${counted} ${counted === 1 ? 'company' : 'companies'} counted. The market is as concentrated as one with ${fmt(equivalentFirms(h), 1)} equally sized companies.`
    : '';

  // Per-row contribution
  document.querySelectorAll('.firm').forEach(li => {
    const f = firms.find(x => x.id === Number(li.dataset.id));
    const c = shareOf(f) ** 2;
    li.querySelector('.contrib-bar').style.width = `${c / maxContrib * 3.5}rem`;
    li.querySelector('.contrib-val').textContent = c > 0 ? fmt(c, c < 10 ? 2 : 0) : '–';
  });

  // Share total
  const sum = el('share-sum');
  sum.classList.toggle('warn', total > 100.5);
  if (!firms.length) sum.textContent = '';
  else if (total > 100.5) sum.textContent = `Shares add up to ${fmt(total, 1)}%, which is more than 100%. Check the numbers.`;
  else if (total < 99.5) sum.textContent = `Shares add up to ${fmt(total, 1)}%. The remaining ${fmt(100 - total, 1)}% is left out, so the HHI shown is a lower bound.`;
  else sum.textContent = `Shares add up to ${fmt(total, 1)}%.`;

  renderMergerOptions();
  updateMerger();
}

function renderMergerOptions() {
  ['m-a', 'm-b'].forEach((id, k) => {
    const sel = el(id);
    const prev = sel.value;
    sel.innerHTML = '';
    firms.forEach((f, i) => {
      const o = document.createElement('option');
      o.value = f.id;
      o.textContent = nameOf(f, i);
      sel.append(o);
    });
    if (firms.some(f => String(f.id) === prev)) sel.value = prev;
    else if (firms[k]) sel.value = firms[k].id;
  });
}

function updateMerger() {
  const out = el('merger-out');
  const a = firms.find(f => String(f.id) === el('m-a').value);
  const b = firms.find(f => String(f.id) === el('m-b').value);
  if (!a || !b || firms.length < 2) { out.textContent = 'Add at least two companies to test a merger.'; return; }
  if (a === b) { out.textContent = 'Pick two different companies.'; return; }
  if (shareOf(a) === 0 || shareOf(b) === 0) { out.textContent = 'Enter market shares for both companies to see the effect.'; return; }

  const before = hhi(firms.map(shareOf));
  const delta = mergerDelta(shareOf(a), shareOf(b));
  const after = before + delta;
  const ia = firms.indexOf(a), ib = firms.indexOf(b);
  const combined = shareOf(a) + shareOf(b);
  const change = classify(after).band !== classify(before).band
    ? ` The market would go from ${classify(before).word} to ${classify(after).word}.`
    : '';
  out.textContent = `A merger between ${nameOf(a, ia)} and ${nameOf(b, ib)} would give the combined company ${fmt(combined, 1)}% of the market and raise the HHI by ${fmt(Math.round(delta))} to ${fmt(Math.round(after))}.${change}`;
}

/* ---------- Actions ---------- */

function load(rows) {
  firms = rows.map(([name, share]) => ({ id: nextId++, name, share }));
  renderRows();
  update();
}

el('load-example').addEventListener('click', () => load(NORWAY_NONLIFE_Q3_2025));
el('clear').addEventListener('click', () => load([['', NaN], ['', NaN]]));
el('add').addEventListener('click', () => {
  const f = { id: nextId++, name: '', share: NaN };
  firms.push(f);
  renderRows(f.id);
  update();
});
el('m-a').addEventListener('change', updateMerger);
el('m-b').addEventListener('change', updateMerger);

// Show the compact value bar once the main result scrolls out of view
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => {
    el('peek').classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
  }, { rootMargin: '-56px 0px 0px 0px' }).observe(el('result'));
}

load(NORWAY_NONLIFE_Q3_2025);
