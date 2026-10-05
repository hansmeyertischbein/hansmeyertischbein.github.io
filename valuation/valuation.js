// Justified price-to-book valuation of an insurer
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/valuation/

/* ---------- Model ----------
   Residual income with constant ROE and growth gives
   P/B = (ROE − g) / (r − g), valid when r > g.
   Growth funded by retained earnings implies payout = 1 − g / ROE. */
const justifiedPB = (roe, r, g) => (roe - g) / (r - g);
const impliedROE = (pb, r, g) => g + pb * (r - g);
const impliedCostOfEquity = (pb, roe, g) => g + (roe - g) / pb;
const impliedPayout = (roe, g) => 1 - g / roe;

const DEFAULTS = { price: 280, bvps: 42.62, roe: 28, r: 8, g: 3 };
const el = id => document.getElementById(id);
const num = v => parseFloat(String(v).replace(',', '.'));
const nok = (n, d = 0) => 'NOK ' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 1) => (n * 100).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const x = n => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'x';

function read() {
  return {
    price: num(el('price').value), bvps: num(el('bvps').value),
    roe: num(el('roe').value) / 100, r: num(el('r').value) / 100, g: num(el('g').value) / 100
  };
}

function update() {
  const v = read();
  const ok = [v.price, v.bvps, v.roe, v.r, v.g].every(Number.isFinite) && v.price > 0 && v.bvps > 0;
  if (!ok) { el('summary').textContent = 'Fill in all five inputs.'; return; }
  if (v.r <= v.g) { el('summary').textContent = 'The cost of equity must be higher than growth, or the model breaks down.'; return; }

  const pb = justifiedPB(v.roe, v.r, v.g);
  const value = pb * v.bvps;
  const marketPB = v.price / v.bvps;
  const gap = value / v.price - 1;
  const iROE = impliedROE(marketPB, v.r, v.g);
  const iR = impliedCostOfEquity(marketPB, v.roe, v.g);
  const payout = impliedPayout(v.roe, v.g);

  el('o-value').innerHTML = `${nok(value)}<small>${gap >= 0 ? pct(gap, 0) + ' above' : pct(-gap, 0) + ' below'} the share price</small>`;
  el('o-pb').innerHTML = `${x(pb)}<small>market pays ${x(marketPB)}</small>`;
  el('o-roe').innerHTML = `${pct(iROE)}<small>needed to justify the price at your cost of equity</small>`;
  el('o-r').innerHTML = `${pct(iR)}<small>implied by the price at your ROE</small>`;
  el('o-payout').innerHTML = `${pct(payout, 0)}<small>of profit, consistent with your ROE and growth</small>`;

  el('summary').textContent = gap < 0
    ? `With these assumptions each share is worth about ${nok(value)}, below the ${nok(v.price)} share price. To justify the price, Gjensidige would need a long-run return on equity of about ${pct(iROE, 0)}, or investors would have to accept a cost of equity of about ${pct(iR)}.`
    : `With these assumptions each share is worth about ${nok(value)}, above the ${nok(v.price)} share price. The price only requires a long-run return on equity of about ${pct(iROE, 0)} at your cost of equity.`;

  renderGrid(v);
}

function renderGrid(v) {
  const roes = [0.24, 0.28, 0.32, 0.36];
  const rs = [0.07, 0.08, 0.09, 0.10];
  const t = el('grid');
  let h = '<thead><tr><th>ROE</th>' + rs.map(r => `<th>${pct(r, 0)}</th>`).join('') + '</tr></thead><tbody>';
  roes.forEach(roe => {
    h += `<tr><th scope="row">${pct(roe, 0)}</th>`;
    rs.forEach(r => {
      const val = r > v.g ? justifiedPB(roe, r, v.g) * v.bvps : NaN;
      const cls = Number.isFinite(val) && val >= v.price ? 'hl' : 'under';
      h += `<td class="${cls}">${Number.isFinite(val) ? Math.round(val) : '–'}</td>`;
    });
    h += '</tr>';
  });
  t.innerHTML = h + '</tbody>';
}

Object.entries(DEFAULTS).forEach(([k, v]) => { el(k).value = v; });
document.querySelectorAll('.fields input').forEach(i => i.addEventListener('input', update));
el('reset').addEventListener('click', () => { Object.entries(DEFAULTS).forEach(([k, v]) => { el(k).value = v; }); update(); });
update();
