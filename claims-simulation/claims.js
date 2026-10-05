// Monte Carlo simulation of an insurer's annual claims
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/claims-simulation/
//
// Each simulated year: number of claims ~ Poisson(policies × frequency),
// each claim ~ lognormal with the chosen mean and coefficient of variation.
// With some probability a storm hits and a share of policies claim at once.

/* ---------- Random numbers (seeded, so a run can be repeated) ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rand) {
  let u = 0; while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
function poisson(lambda, rand) {
  if (lambda > 60) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(rand)));
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
// Lognormal parameters from mean m and coefficient of variation c
function lognormalParams(m, c) {
  const s2 = Math.log(1 + c * c);
  return { mu: Math.log(m) - s2 / 2, sigma: Math.sqrt(s2) };
}

/* ---------- Simulation ---------- */
function simulate(p, years, seed) {
  const rand = mulberry32(seed);
  const { mu, sigma } = lognormalParams(p.severity, p.cv);
  const totals = new Float64Array(years);
  for (let y = 0; y < years; y++) {
    let n = poisson(p.policies * p.freq, rand);
    if (rand() < p.stormProb) n += poisson(p.policies * p.stormShare, rand);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.exp(mu + sigma * normal(rand));
    totals[y] = sum;
  }
  return totals;
}

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/* ---------- UI ---------- */
const el = id => document.getElementById(id);
const DEFAULTS = { policies: 10000, freq: 8, severity: 30000, cv: 3, loading: 15, stormProb: 3, stormShare: 5 };
const fmtNok = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return 'NOK ' + (n / 1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return 'NOK ' + (n / 1e6).toFixed(1) + 'm';
  return 'NOK ' + Math.round(n).toLocaleString('en-US');
};
const pct = (n, d = 1) => (n * 100).toFixed(d) + '%';
let seed = 20260705;

function read() {
  const g = id => parseFloat(String(el(id).value).replace(',', '.'));
  return {
    policies: Math.max(1, Math.round(g('policies'))), freq: g('freq') / 100, severity: g('severity'),
    cv: g('cv'), loading: g('loading') / 100, stormProb: g('stormProb') / 100, stormShare: g('stormShare') / 100
  };
}

function run() {
  const p = read();
  if (![p.policies, p.freq, p.severity, p.cv, p.loading, p.stormProb, p.stormShare].every(Number.isFinite) || p.severity <= 0 || p.cv < 0) {
    el('summary').textContent = 'Check the inputs.'; return;
  }
  // Keep the number of random draws manageable
  const claimsPerYear = p.policies * (p.freq + p.stormProb * p.stormShare);
  const years = Math.max(2000, Math.min(20000, Math.floor(4e6 / Math.max(1, claimsPerYear))));

  const t0 = performance.now();
  const totals = simulate(p, years, seed);
  const sorted = Float64Array.from(totals).sort();
  const mean = totals.reduce((a, b) => a + b, 0) / years;
  const expected = p.policies * (p.freq + p.stormProb * p.stormShare) * p.severity;
  const premium = expected * (1 + p.loading);
  const var995 = quantile(sorted, 0.995);
  const lossYears = totals.filter(t => t > premium).length / years;
  const capital = Math.max(0, var995 - premium);
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / (years - 1));

  el('o-expected').innerHTML = `${fmtNok(expected)}<small>simulated average ${fmtNok(mean)}</small>`;
  el('o-premium').innerHTML = `${fmtNok(premium)}<small>claims ratio ${pct(1 / (1 + p.loading), 0)} in an average year</small>`;
  el('o-loss').innerHTML = `${pct(lossYears)}<small>claims exceed premiums</small>`;
  el('o-var').innerHTML = `${fmtNok(var995)}<small>${(var995 / premium).toFixed(2)}x the premium</small>`;
  el('o-capital').innerHTML = `${fmtNok(capital)}<small>${pct(capital / premium, 0)} of premium</small>`;
  el('o-cv').innerHTML = `${pct(sd / mean, 1)}<small>standard deviation ÷ mean</small>`;
  el('summary').textContent = `In ${years.toLocaleString('en-US')} simulated years, claims beat premiums ${pct(lossYears)} of the time. To survive the worst year in 200, the insurer needs about ${fmtNok(capital)} of capital on top of the premium, ${pct(capital / premium, 0)} of a year’s premium income.`;
  el('meta').textContent = `${years.toLocaleString('en-US')} years simulated in ${Math.round(performance.now() - t0)} ms. Seed ${seed}.`;

  drawHistogram(sorted, premium, var995);
}

function drawHistogram(sorted, premium, var995) {
  const W = 400, H = 190, L = 6, R = 6, T = 12, B = 34, bins = 40;
  const lo = sorted[0], hi = quantile(sorted, 0.999);
  const width = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of sorted) { if (v <= hi) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]++; }
  const max = Math.max(...counts);
  const X = v => L + (v - lo) / (hi - lo) * (W - L - R);
  const bw = (W - L - R) / bins;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of simulated annual claims"><g>`;
  counts.forEach((c, i) => {
    const h = c / max * (H - T - B);
    const x0 = lo + i * width;
    const fill = x0 + width > premium ? 'var(--navy)' : 'color-mix(in srgb, var(--navy) 35%, transparent)';
    s += `<rect x="${(L + i * bw + 0.5).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${h.toFixed(1)}" style="fill:${fill}"/>`;
  });
  s += `</g><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" style="stroke:var(--rule)"/>`;
  const mark = (v, label, anchor) => {
    if (v < lo || v > hi) return '';
    const x = X(v);
    if (x > W * 0.75) anchor = 'end';
    else if (x < W * 0.25) anchor = 'start';
    return `<line x1="${x.toFixed(1)}" y1="${T - 6}" x2="${x.toFixed(1)}" y2="${H - B}" style="stroke:var(--ink)" stroke-dasharray="3 3"/><text x="${(x + (anchor === 'end' ? -4 : 4)).toFixed(1)}" y="${T + 2}" text-anchor="${anchor}" style="fill:var(--ink)">${label}</text>`;
  };
  s += mark(premium, 'Premium', 'end') + mark(var995, '1 in 200', 'start').replace(`y="${T + 2}"`, `y="${T + 16}"`);
  s += `<text x="${L}" y="${H - 12}">${fmtNok(lo)}</text><text x="${W - R}" y="${H - 12}" text-anchor="end">${fmtNok(hi)}</text>`;
  s += `<text x="${W / 2}" y="${H - 12}" text-anchor="middle">Total claims in a year</text></svg>`;
  el('hist').innerHTML = s;
}

Object.entries(DEFAULTS).forEach(([k, v]) => { el(k).value = v; });
let timer;
document.querySelectorAll('.fields input').forEach(i => i.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 250); }));
el('rerun').addEventListener('click', () => { seed = Math.floor(Math.random() * 1e9); run(); });
el('reset').addEventListener('click', () => { Object.entries(DEFAULTS).forEach(([k, v]) => { el(k).value = v; }); seed = 20260705; run(); });
run();
