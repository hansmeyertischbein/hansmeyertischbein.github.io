// "What does it cost to wait?" – prioritisation calculator
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/priority/
//
// P = (V / p) × exp(−max(A − p, 0) / H)
//   V  value at stake, anchored scale 1, 2, 3, 5, 8, 13, 21
//   p  calibrated time estimate in hours
//   A  plannable hours until the deadline
//   H  urgency horizon (two days of plannable time)

/* ---------- Model ---------- */

const VALUE_SCALE = [
  [1, 'Negligible'], [2, 'Minor'], [3, 'Noticeable'], [5, 'Moderate'],
  [8, 'Significant'], [13, 'Major'], [21, 'Very large']
];

// Three-point (PERT) estimate if optimistic and pessimistic are given, then calibrated by k
function calibratedHours(t, k) {
  const m = t.hours;
  const hasThree = Number.isFinite(t.opt) && Number.isFinite(t.pess) && t.opt > 0 && t.pess > 0;
  const base = hasThree ? (t.opt + 4 * m + t.pess) / 6 : m;
  return k * base;
}

function urgency(slack, H) {
  return Math.exp(-Math.max(slack, 0) / H);
}

function priority(V, p, A, H) {
  const slack = A - p;
  const U = urgency(slack, H);
  return { slack, U, P: (V / p) * U };
}

// Earliest-due-date check (Jackson's rule): cumulative work vs plannable time at each deadline
function feasibility(items, perDay) {
  const sorted = [...items].sort((a, b) => a.days - b.days);
  let need = 0;
  const checks = [];
  sorted.forEach(it => {
    need += it.p;
    const have = it.days * perDay;
    const last = checks[checks.length - 1];
    if (last && last.days === it.days) { last.need = need; last.names.push(it.label); }
    else checks.push({ days: it.days, need, have, names: [it.label] });
  });
  checks.forEach(c => { c.gap = c.have - c.need; });
  return checks;
}

/* ---------- State ---------- */

const STORE = 'priority-tool-v1';
const DEFAULT_SETTINGS = { hoursPerDay: 5, planShare: 80, k: 1.5 };

const EXAMPLE = [
  { name: 'Work task due tomorrow morning', value: 8, hours: 2, days: 1 },
  { name: 'Methods assignment, 40% of grade', value: 13, hours: 10, days: 4 },
  { name: 'Prepare student board meeting', value: 3, hours: 1.5, days: 2 },
  { name: 'Exam preparation, 60% of grade', value: 21, hours: 40, days: 8, parts: 6 },
  { name: 'Improve CV and applications', value: 8, hours: 4, days: 10 },
  { name: 'Emails and messages', value: 1, hours: 0.5, days: 2, batch: true }
];

let settings = { ...DEFAULT_SETTINGS };
let tasks = [];
let nextId = 1;

const blankTask = () => ({ id: nextId++, name: '', value: 5, hours: NaN, days: NaN, opt: NaN, pess: NaN, parts: 1, batch: false });
const fromPlain = t => ({ ...blankTask(), ...t, id: nextId++ });

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ settings, tasks: tasks.map(({ id, ...t }) => t) }));
  } catch (e) { /* storage unavailable: keep working without saving */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return false;
    const data = JSON.parse(raw);
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    tasks = (data.tasks || []).map(t => fromPlain(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === null ? NaN : v]))));
    return true;
  } catch (e) { return false; }
}

/* ---------- Helpers ---------- */

const el = id => document.getElementById(id);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const fmt = (n, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
const fmtP = p => (p >= 0.1 ? p.toFixed(2) : p > 0 ? p.toPrecision(2) : '0');
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;
const perDay = () => settings.hoursPerDay * settings.planShare / 100;
const horizon = () => 2 * perDay();
const removeIcon = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg>';

function make(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  children.forEach(c => n.append(c));
  return n;
}

function numberInput(task, key, opts) {
  const input = make('input', { class: 'field', type: 'number', inputmode: 'decimal', min: '0', step: opts.step || '0.5', placeholder: opts.placeholder || '' });
  input.value = Number.isFinite(task[key]) ? task[key] : '';
  input.setAttribute('aria-label', opts.aria);
  input.addEventListener('input', () => { task[key] = num(input.value); update(); });
  return input;
}

/* ---------- Task rows ---------- */

function renderRows(focusId) {
  const list = el('tasks');
  list.innerHTML = '';
  tasks.forEach((t, i) => {
    const name = make('input', { class: 'field t-name', type: 'text', placeholder: `Task ${i + 1}`, 'aria-label': `Name of task ${i + 1}` });
    name.value = t.name;
    name.addEventListener('input', () => { t.name = name.value; update(); });

    const value = make('select', { class: 'field', 'aria-label': 'Value at stake' });
    VALUE_SCALE.forEach(([v, label]) => value.append(make('option', { value: v, text: `${v} ${label}` })));
    value.value = t.value;
    value.addEventListener('change', () => { t.value = Number(value.value); update(); });

    const hours = numberInput(t, 'hours', { aria: 'Estimated hours', placeholder: '0' });
    const days = numberInput(t, 'days', { aria: 'Deadline in days from today', placeholder: '–' });

    const rm = make('button', { class: 'btn btn-quiet remove', type: 'button', html: removeIcon, 'aria-label': `Remove task ${i + 1}`,
      onclick: () => { tasks = tasks.filter(x => x.id !== t.id); renderRows(); update(); } });

    const main = make('div', { class: 'task-main' }, [
      name,
      make('label', { class: 't-value' }, [make('span', { class: 'lbl', text: 'Value' }), value]),
      make('label', { class: 't-hours' }, [make('span', { class: 'lbl', text: 'Hours' }), hours]),
      make('label', { class: 't-days' }, [make('span', { class: 'lbl', text: 'Due in days' }), days]),
      rm
    ]);

    const batch = make('input', { type: 'checkbox' });
    batch.checked = !!t.batch;
    batch.addEventListener('change', () => { t.batch = batch.checked; update(); });

    const more = make('details', {}, [
      make('summary', { text: 'More options' }),
      make('div', { class: 'more' }, [
        make('label', {}, ['Optimistic hours', numberInput(t, 'opt', { aria: 'Optimistic hours' })]),
        make('label', {}, ['Pessimistic hours', numberInput(t, 'pess', { aria: 'Pessimistic hours' })]),
        make('label', {}, ['Split into parts', numberInput(t, 'parts', { aria: 'Number of parts', step: '1', placeholder: '1' })]),
        make('label', { class: 'check' }, [batch, 'Daily batch, leave out of the ranking']),
        make('p', { class: 'more-note', text: 'With parts, value and time are shared equally and the deadline applies to the next part.' })
      ])
    ]);
    if (t.batch || t.parts > 1 || Number.isFinite(t.opt) || Number.isFinite(t.pess)) more.open = true;

    list.append(make('li', { class: 'task' }, [main, more]));
    if (t.id === focusId) name.focus();
  });
}

/* ---------- Results ---------- */

function update() {
  const k = settings.k > 0 ? settings.k : 1;
  const A = perDay();
  const H = horizon();

  el('s-summary').textContent = A > 0
    ? `You plan ${fmt(A, 2)} hours a day and keep the rest as buffer. Urgency horizon: ${fmt(H, 2)} hours.`
    : 'Enter how many hours you have per day.';

  const ranked = [], batch = [], incomplete = [];
  tasks.forEach((t, i) => {
    const label = t.name.trim() || `Task ${i + 1}`;
    if (t.batch) { batch.push(label); return; }
    if (!(t.hours > 0) || !(t.days >= 0) || !(A > 0)) { incomplete.push(label); return; }
    const parts = Math.max(1, Math.round(t.parts || 1));
    const pTotal = calibratedHours(t, k);
    const p = pTotal / parts;
    const V = t.value / parts;
    const avail = t.days * A;
    const r = priority(V, p, avail, H);
    ranked.push({ label: parts > 1 ? `${label}, part 1 of ${parts}` : label, value: t.value, V, p, days: t.days, avail, parts, bigger: parts === 1 && p > A, ...r });
  });
  ranked.sort((a, b) => b.P - a.P);

  renderRanking(ranked, batch, incomplete);
  renderFeasibility(ranked, A);
  save();
}

function renderRanking(ranked, batch, incomplete) {
  const list = el('ranking');
  list.innerHTML = '';
  if (!ranked.length) {
    list.append(make('li', { class: 'empty', text: 'Add tasks with hours and a deadline to see the ranking.' }));
  }
  ranked.forEach((r, i) => {
    const slackText = r.slack < 0 ? `${fmt(-r.slack, 2)} h short` : `${fmt(r.slack, 2)} h slack`;
    const tags = [];
    if (i >= 3 && r.value >= 8 && r.U < 0.1) tags.push('Book a fixed block');
    if (r.bigger) tags.push('Bigger than a day, consider splitting');
    if (r.slack < 0) tags.push('Cannot make the deadline');

    list.append(make('li', { class: `rank${i < 3 ? ' now' : ''}` }, [
      make('span', { class: 'rank-no', text: String(i + 1) }),
      make('p', { class: 'rank-name', text: r.label }),
      make('span', { class: 'rank-p', html: `${fmtP(r.P)}<small>INDEX</small>` }),
      make('p', { class: 'rank-meta', text: `${fmt(r.p, 2)} h of work, due in ${plural(r.days, 'day')}, ${slackText}, urgency ${r.U.toFixed(2)}` }),
      make('div', { class: 'rank-tags' }, tags.map(t => make('span', { class: 'tag', text: t })))
    ]));
  });

  const extra = el('batch');
  extra.innerHTML = '';
  if (batch.length) extra.append(make('p', { class: 'batch', text: `In the daily batch: ${batch.join(', ')}.` }));
  if (incomplete.length) extra.append(make('p', { class: 'batch', text: `Missing hours or a deadline: ${incomplete.join(', ')}. Give every task a deadline, even a self-imposed one.` }));
}

function renderFeasibility(ranked, A) {
  const verdict = el('verdict');
  const list = el('checks');
  list.innerHTML = '';
  verdict.className = 'verdict';
  const oldSub = document.querySelector('.verdict-sub');
  if (oldSub) oldSub.remove();

  if (!ranked.length) { verdict.textContent = 'Nothing to check yet.'; return; }

  const checks = feasibility(ranked, A);
  const worst = checks.reduce((m, c) => (c.gap < m.gap ? c : m), checks[0]);
  const sub = make('p', { class: 'verdict-sub' });

  if (worst.gap < 0) {
    verdict.classList.add('short');
    verdict.textContent = `Short by ${fmt(-worst.gap, 2)} hours by day ${fmt(worst.days)}.`;
    sub.textContent = 'Close the gap now rather than the night before: renegotiate a deadline, cut scope or hand off work, starting where it costs the least value per hour freed.';
  } else {
    verdict.textContent = `The plan adds up, with ${fmt(worst.gap, 2)} hours to spare at the tightest deadline (day ${fmt(worst.days)}).`;
    sub.textContent = 'Every deadline can be met as long as the estimates hold.';
  }
  verdict.after(sub);

  const maxV = Math.max(...checks.map(c => Math.max(c.need, c.have)), 1);
  checks.forEach(c => {
    const short = c.gap < 0;
    list.append(make('li', { class: `check-row${short ? ' short' : ''}`, title: c.names.join(', ') }, [
      make('span', { class: 'check-day', text: `Day ${fmt(c.days)}` }),
      make('span', { class: 'check-bar', html: `<span class="check-fill" style="width:${c.need / maxV * 100}%"></span><span class="check-cap" style="left:${c.have / maxV * 100}%"></span>` }),
      make('span', { class: 'check-num', text: `${fmt(c.need, 2)} of ${fmt(c.have, 2)} h` })
    ]));
  });
}

/* ---------- Settings and actions ---------- */

function bindSetting(id, key) {
  const input = el(id);
  input.value = settings[key];
  input.addEventListener('input', () => {
    const v = num(input.value);
    if (Number.isFinite(v) && v > 0) { settings[key] = v; update(); }
  });
}

function load(list) {
  tasks = list.map(fromPlain);
  renderRows();
  update();
}

el('load-example').addEventListener('click', () => {
  settings = { ...DEFAULT_SETTINGS };
  ['s-hours', 's-plan', 's-k'].forEach((id, i) => { el(id).value = settings[['hoursPerDay', 'planShare', 'k'][i]]; });
  load(EXAMPLE);
});
el('clear').addEventListener('click', () => load([{}, {}]));
el('add').addEventListener('click', () => {
  const t = blankTask();
  tasks.push(t);
  renderRows(t.id);
  update();
});

if (!restore()) tasks = EXAMPLE.map(fromPlain);
bindSetting('s-hours', 'hoursPerDay');
bindSetting('s-plan', 'planShare');
bindSetting('s-k', 'k');
renderRows();
update();
