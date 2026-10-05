// Market sizing: contents insurance for students in Norway
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/student-insurance-case/

const el = id => document.getElementById(id);
const DEF = { students: 308097, home: 15, parents: 25, bought: 60, premium: 1500 };
const g = id => parseFloat(String(el(id).value).replace(',', '.'));
const n0 = n => Math.round(n).toLocaleString('en-US');
const nokM = n => 'NOK ' + (n / 1e6).toFixed(0) + 'm';

// Funnel: all students → living away from home → not covered by parents' policy → own policy
function size(p) {
  const away = p.students * (1 - p.home);
  const needOwn = away * (1 - p.parents);
  const insured = needOwn * p.bought;
  return { away, needOwn, insured, market: insured * p.premium, potential: needOwn * p.premium };
}

function update() {
  const p = { students: g('students'), home: g('home') / 100, parents: g('parents') / 100, bought: g('bought') / 100, premium: g('premium') };
  if (!Object.values(p).every(Number.isFinite)) return;
  const s = size(p);
  el('o-market').innerHTML = `${nokM(s.market)}<small>${n0(s.insured)} students with their own policy</small>`;
  el('o-potential').innerHTML = `${nokM(s.potential)}<small>if every student who needs a policy had one</small>`;
  el('o-gap').innerHTML = `${n0(s.needOwn - s.insured)}<small>students who need cover but lack it</small>`;

  const steps = [['All students', p.students], ['Living away from home', s.away], ['Not covered by parents', s.needOwn], ['Own policy today', s.insured]];
  const max = p.students;
  el('funnel').innerHTML = steps.map(([label, v]) => `<div class="f-row"><span class="f-label">${label}</span><span class="f-bar"><span style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="f-num">${n0(v)}</span></div>`).join('');

  // Sensitivity: which assumption moves the answer most?
  const base = s.market;
  const swing = [
    ['Share with own policy ±15 pts', size({ ...p, bought: Math.min(1, p.bought + 0.15) }).market - size({ ...p, bought: Math.max(0, p.bought - 0.15) }).market],
    ['Covered by parents ±15 pts', size({ ...p, parents: Math.max(0, p.parents - 0.15) }).market - size({ ...p, parents: Math.min(1, p.parents + 0.15) }).market],
    ['Premium ±NOK 500', size({ ...p, premium: p.premium + 500 }).market - size({ ...p, premium: Math.max(0, p.premium - 500) }).market],
    ['Living at home ±10 pts', size({ ...p, home: Math.max(0, p.home - 0.10) }).market - size({ ...p, home: Math.min(1, p.home + 0.10) }).market]
  ].sort((a, b) => b[1] - a[1]);
  const mx = Math.max(...swing.map(s => s[1]));
  el('tornado').innerHTML = swing.map(([l, v]) => `<div class="f-row"><span class="f-label">${l}</span><span class="f-bar"><span style="width:${(v / mx * 100).toFixed(1)}%"></span></span><span class="f-num">${nokM(v)}</span></div>`).join('');
}

Object.entries(DEF).forEach(([k, v]) => { el(k).value = v; });
document.querySelectorAll('.fields input').forEach(i => i.addEventListener('input', update));
el('reset').addEventListener('click', () => { Object.entries(DEF).forEach(([k, v]) => { el(k).value = v; }); update(); });
update();
