/* Kalkulator: etterbetaling av overtidstillegg for merarbeid (deltidsansatte). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const AGA = 0.141; // arbeidsgiveravgift, sone I
  // Forsinkelsesrente per halvår (Finanstilsynet). Nøkkel: år*2 + (0 = jan–jun, 1 = jul–des)
  const RATES = { 4044: 8.5, 4045: 9.25, 4046: 10.75, 4047: 11.75, 4048: 12.5, 4049: 12.5, 4050: 12.5, 4051: 12.25, 4052: 12.0, 4053: 12.25 };
  const rateAt = d => {
    const k = d.getFullYear() * 2 + (d.getMonth() >= 6 ? 1 : 0);
    if (RATES[k] != null) return RATES[k];
    const keys = Object.keys(RATES).map(Number);
    return RATES[k < keys[0] ? keys[0] : keys[keys.length - 1]];
  };
  const kr = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
  const t1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
  const money = v => kr.format(Math.round(v)) + ' kr';
  const num = id => { const s = String($(id).value).replace(/\s/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); };
  let mode = 'uke';

  // simple interest from `from` to `to`, rate changing each half-year
  function interest(amount, from, to) {
    let sum = 0, d = new Date(from);
    while (d < to) {
      const next = new Date(d.getFullYear(), d.getMonth() >= 6 ? 12 : 6, 1);
      const end = next < to ? next : to;
      sum += amount * rateAt(d) / 100 * (end - d) / (365 * 864e5);
      d = end;
    }
    return sum;
  }

  function read() {
    const v = { pct: num('k-pct'), norm: +$('k-norm').value, avg: num('k-avg'), weeks: num('k-weeks'), hours: num('k-hours'),
      months: num('k-months'), wage: num('k-wage'), sup: num('k-sup'), fp: num('k-fp'), int: $('k-int').checked };
    const err = [];
    if (!(v.pct > 0 && v.pct < 100)) err.push('Stillingsprosenten må være mellom 0 og 100.');
    if (mode === 'uke' && !(v.avg >= 0)) err.push('Oppgi faktisk jobbede timer per uke.');
    if (mode === 'uke' && !(v.weeks > 0 && v.weeks <= 52)) err.push('Uker med arbeid må være mellom 1 og 52.');
    if (mode === 'timer' && !(v.hours >= 0)) err.push('Oppgi antall timer merarbeid.');
    if (!(v.months >= 1 && v.months <= 120)) err.push('Perioden må være mellom 1 og 120 måneder.');
    if (!(v.wage > 0)) err.push('Oppgi timelønn.');
    if (!(v.sup >= 0)) err.push('Oppgi overtidstillegg i prosent.');
    if (!(v.fp >= 0)) err.push('Oppgi feriepenger i prosent.');
    v.months = Math.round(v.months);
    return { v, err };
  }

  function calc(v) {
    const agreed = v.pct / 100 * v.norm;
    let perMonth, perWeek = null, capped = false;
    if (mode === 'uke') {
      perWeek = Math.max(0, Math.min(v.avg, v.norm) - agreed);
      capped = v.avg > v.norm;
      perMonth = perWeek * v.weeks / 12;
    } else perMonth = v.hours / v.months;
    const today = new Date();
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1); // slutten av siste hele måned
    const rows = new Map();
    let H = 0, S = 0, F = 0, I = 0;
    for (let i = 0; i < v.months; i++) {
      const due = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth() - i, 1); // betales ved månedsslutt
      const year = due.getFullYear() - (due.getMonth() === 0 ? 1 : 0); // månedens år (forfall 1. jan = desember)
      const s = perMonth * v.wage * v.sup / 100, f = s * v.fp / 100;
      const r = v.int ? interest(s + f, due, today) : 0;
      const row = rows.get(year) || { h: 0, s: 0, f: 0, r: 0 };
      row.h += perMonth; row.s += s; row.f += f; row.r += r;
      rows.set(year, row);
      H += perMonth; S += s; F += f; I += r;
    }
    const monthLoss = (S + F) / v.months;
    const yearAhead = perWeek != null ? perWeek * v.weeks * v.wage * v.sup / 100 * (1 + v.fp / 100) : perMonth * 12 * v.wage * v.sup / 100 * (1 + v.fp / 100);
    return { agreed, perWeek, perMonth, capped, H, S, F, I, total: S + F + I, monthLoss, yearAhead, aga: (S + F) * (1 + AGA), rows };
  }

  function kpi(dt, dd, small) {
    return `<div><dt>${dt}</dt><dd>${dd}${small ? `<small>${small}</small>` : ''}</dd></div>`;
  }

  function render() {
    document.querySelectorAll('[data-for]').forEach(l => { l.hidden = l.dataset.for !== mode; });
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const { v, err } = read();
    $('k-err').textContent = err.join(' ');
    if (err.length) { $('k-verdict').textContent = ''; $('k-kpis').innerHTML = ''; $('k-table').hidden = true; return; }
    const r = calc(v);
    const years = v.months / 12;
    const period = v.months % 12 === 0 ? `${v.months / 12} år` : `${v.months} måneder`;
    if (r.H <= 0) {
      $('k-verdict').textContent = `Med ${t1.format(v.pct)} prosent stilling er avtalt tid ${t1.format(r.agreed)} timer i uka. Du har ikke oppgitt merarbeid ut over det, så det er ikke noe å kreve.`;
      $('k-kpis').innerHTML = ''; $('k-table').hidden = true; return;
    }
    $('k-verdict').textContent = `Med disse tallene kan kravet for ${period} bli om lag ${money(r.total)} før skatt${v.int ? ', inkludert renter' : ''}.`;
    let html = '';
    html += kpi('Merarbeid i perioden', `${kr.format(Math.round(r.H))} t`,
      r.perWeek != null ? `${t1.format(r.perWeek)} t per uke ut over avtalt ${t1.format(r.agreed)} t${r.capped ? '. Timer over heltid er holdt utenfor' : ''}` : `${t1.format(r.perMonth)} t per måned`);
    html += kpi('Overtidstillegg', money(r.S), `${t1.format(v.sup)} % av ${money(v.wage)} per time`);
    html += kpi('Feriepenger', money(r.F), `${t1.format(v.fp)} % av tillegget`);
    if (v.int) html += kpi('Forsinkelsesrente', money(r.I), 'Øvre anslag, fra hver måned til i dag');
    html += kpi('Foreldes per måned', money(r.monthLoss), 'Så mye faller bort for hver måned uten fristavbrudd');
    html += kpi('Per år framover', money(r.yearAhead), 'Hvis tillegget regnes fra avtalt stilling');
    html += kpi('Arbeidsgivers kostnad', money(r.aga), 'Tillegg og feriepenger med 14,1 % arbeidsgiveravgift, uten renter');
    $('k-kpis').innerHTML = html;
    // tabell per kalenderår
    const tb = $('k-table').tBodies[0];
    const ys = [...r.rows.keys()].sort();
    tb.innerHTML = ys.map(y => { const o = r.rows.get(y); return `<tr><td>${y}</td><td>${kr.format(Math.round(o.h))}</td><td>${kr.format(Math.round(o.s))}</td><td>${kr.format(Math.round(o.f))}</td>${v.int ? `<td>${kr.format(Math.round(o.r))}</td>` : ''}<td>${kr.format(Math.round(o.s + o.f + o.r))}</td></tr>`; }).join('')
      + `<tr class="hl"><td>Sum</td><td>${kr.format(Math.round(r.H))}</td><td>${kr.format(Math.round(r.S))}</td><td>${kr.format(Math.round(r.F))}</td>${v.int ? `<td>${kr.format(Math.round(r.I))}</td>` : ''}<td>${kr.format(Math.round(r.total))}</td></tr>`;
    $('k-table').querySelectorAll('[data-int]').forEach(th => { th.hidden = !v.int; });
    $('k-table').hidden = false;
    if (years > 3) $('k-err').textContent = 'Merk: Krav eldre enn tre år er normalt foreldet.';
  }

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
  ['k-pct', 'k-avg', 'k-weeks', 'k-hours', 'k-months', 'k-wage', 'k-sup', 'k-fp'].forEach(id => $(id).addEventListener('input', render));
  ['k-norm', 'k-int'].forEach(id => $(id).addEventListener('change', render));
  render();
})();
