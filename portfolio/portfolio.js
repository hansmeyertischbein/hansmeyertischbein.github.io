// Two-asset portfolio, efficient frontier and CAPM
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/portfolio/

/* ---------- Model ---------- */
function portfolio(w, a, b, rho) {
  const ret = w * a.ret + (1 - w) * b.ret;
  const variance = w * w * a.vol ** 2 + (1 - w) ** 2 * b.vol ** 2 + 2 * w * (1 - w) * rho * a.vol * b.vol;
  return { ret, vol: Math.sqrt(Math.max(variance, 0)) };
}
// Weight in A that gives the lowest variance
function minVarianceWeight(a, b, rho) {
  const cov = rho * a.vol * b.vol;
  return (b.vol ** 2 - cov) / (a.vol ** 2 + b.vol ** 2 - 2 * cov);
}
// Weight in A that maximises the Sharpe ratio (tangency portfolio)
function tangencyWeight(a, b, rho, rf) {
  const ea = a.ret - rf, eb = b.ret - rf, cov = rho * a.vol * b.vol;
  return (ea * b.vol ** 2 - eb * cov) / (ea * b.vol ** 2 + eb * a.vol ** 2 - (ea + eb) * cov);
}
const sharpe = (p, rf) => (p.ret - rf) / p.vol;
const capm = (rf, beta, mrp) => rf + beta * mrp;

/* ---------- UI ---------- */
const el = id => document.getElementById(id);
const DEF = { aName: 'Global equities', aRet: 8.5, aVol: 16, bName: 'Norwegian government bonds', bRet: 4.2, bVol: 5, rho: 0.1, rf: 4.0, w: 60, cRf: 4.0, cBeta: 1.0, cMrp: 5.0 };
const g = id => parseFloat(String(el(id).value).replace(',', '.'));
const pct = (n, d = 1) => (n * 100).toFixed(d) + '%';

function update() {
  const a = { name: el('aName').value || 'Asset A', ret: g('aRet') / 100, vol: g('aVol') / 100 };
  const b = { name: el('bName').value || 'Asset B', ret: g('bRet') / 100, vol: g('bVol') / 100 };
  const rho = Math.max(-1, Math.min(1, g('rho')));
  const rf = g('rf') / 100;
  const w = g('w') / 100;
  el('wOut').textContent = `${Math.round(w * 100)}% / ${Math.round((1 - w) * 100)}%`;
  el('wLabel').textContent = `Share in ${a.name}`;
  if (![a.ret, a.vol, b.ret, b.vol, rho, rf].every(Number.isFinite) || a.vol <= 0 || b.vol <= 0) return;

  const cur = portfolio(w, a, b, rho);
  const wMin = minVarianceWeight(a, b, rho);
  const pMin = portfolio(wMin, a, b, rho);
  const wTan = tangencyWeight(a, b, rho, rf);
  const pTan = portfolio(wTan, a, b, rho);
  const tanValid = Number.isFinite(wTan) && pTan.ret > rf;

  el('o-cur').innerHTML = `${pct(cur.ret)}<small>expected return, volatility ${pct(cur.vol)}</small>`;
  el('o-sharpe').innerHTML = `${sharpe(cur, rf).toFixed(2)}<small>return above risk-free per unit of risk</small>`;
  el('o-min').innerHTML = `${pct(wMin, 0)}<small>in ${a.name}, volatility ${pct(pMin.vol)}</small>`;
  el('o-tan').innerHTML = tanValid
    ? `${pct(wTan, 0)}<small>in ${a.name}, Sharpe ${sharpe(pTan, rf).toFixed(2)}${wTan > 1 || wTan < 0 ? ', needs borrowing or short selling' : ''}</small>`
    : `–<small>no portfolio beats the risk-free rate</small>`;

  draw(a, b, rho, rf, cur, pMin, tanValid ? pTan : null);
}

function draw(a, b, rho, rf, cur, pMin, pTan) {
  const W = 400, H = 260, L = 40, R = 12, T = 12, B = 34;
  const pts = []; for (let i = 0; i <= 100; i++) pts.push(portfolio(i / 100, a, b, rho));
  const nice = max => { const steps = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2]; const st = steps.find(s => max / s <= 5) || 0.25; return { step: st, top: Math.ceil(max / st) * st }; };
  const vx = nice(Math.max(a.vol, b.vol, pTan ? Math.min(pTan.vol, 1) : 0) * 1.1);
  const maxVol = vx.top;
  const rets = [a.ret, b.ret, rf, pTan ? pTan.ret : rf];
  const minR = Math.min(...rets, 0);
  const ry = nice(Math.max(...rets) * 1.1 - minR);
  const maxR = minR + ry.top;
  const X = v => L + v / maxVol * (W - L - R);
  const Y = r => T + (maxR - r) / (maxR - minR) * (H - T - B);
  const lab = v => (Math.round(v * 1000) / 10).toString() + '%';
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Efficient frontier">`;
  for (let r = minR; r <= maxR + 1e-9; r += ry.step) {
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(r).toFixed(1)}" y2="${Y(r).toFixed(1)}" style="stroke:var(--rule)"/><text x="${L - 6}" y="${(Y(r) + 4).toFixed(1)}" text-anchor="end">${lab(r)}</text>`;
  }
  for (let v = 0; v <= maxVol + 1e-9; v += vx.step) {
    s += `<text x="${X(v).toFixed(1)}" y="${H - 16}" text-anchor="middle">${lab(v)}</text>`;
  }
  s += `<text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle">Volatility</text>`;
  if (pTan) {
    const slope = (pTan.ret - rf) / pTan.vol;
    const vEnd = maxVol;
    s += `<line x1="${X(0)}" y1="${Y(rf).toFixed(1)}" x2="${X(vEnd).toFixed(1)}" y2="${Y(rf + slope * vEnd).toFixed(1)}" style="stroke:var(--muted)" stroke-dasharray="4 4"/>`;
  }
  s += `<polyline fill="none" style="stroke:var(--navy)" stroke-width="2.5" points="${pts.map(p => `${X(p.vol).toFixed(1)},${Y(p.ret).toFixed(1)}`).join(' ')}"/>`;
  const dot = (p, label, style, dx = 6, anchor = 'start') => `<circle cx="${X(p.vol).toFixed(1)}" cy="${Y(p.ret).toFixed(1)}" r="5" style="${style}"/><text x="${(X(p.vol) + dx).toFixed(1)}" y="${(Y(p.ret) - 7).toFixed(1)}" text-anchor="${anchor}" style="fill:var(--ink)">${label}</text>`;
  s += dot({ vol: 0, ret: rf }, 'Risk-free', 'fill:var(--muted)');
  s += dot(a, a.name.split(' ')[0], 'fill:var(--paper);stroke:var(--navy);stroke-width:2', -6, 'end');
  s += dot(b, b.name.split(' ')[0], 'fill:var(--paper);stroke:var(--navy);stroke-width:2');
  if (pTan && pTan.vol <= maxVol) s += dot(pTan, 'Best Sharpe', 'fill:var(--muted)', -6, 'end');
  s += dot(cur, 'You', 'fill:var(--navy)');
  el('chart').innerHTML = s + '</svg>';
}

function updateCapm() {
  const rf = g('cRf') / 100, beta = g('cBeta'), mrp = g('cMrp') / 100;
  if (![rf, beta, mrp].every(Number.isFinite)) return;
  el('o-capm').innerHTML = `${pct(capm(rf, beta, mrp))}<small>${pct(rf)} + ${beta.toFixed(2)} × ${pct(mrp)}</small>`;
}

Object.entries(DEF).forEach(([k, v]) => { el(k).value = v; });
document.querySelectorAll('#frontier input').forEach(i => i.addEventListener('input', update));
document.querySelectorAll('#capm input').forEach(i => i.addEventListener('input', updateCapm));
el('reset').addEventListener('click', () => { Object.entries(DEF).forEach(([k, v]) => { el(k).value = v; }); update(); updateCapm(); });
update(); updateCapm();
