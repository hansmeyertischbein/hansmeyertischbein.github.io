/* LBO calculator for a fictional company (TargetCo). Annual model:
 * interest on opening balances, tax with loss carry-forward, scheduled senior amortisation,
 * cash sweep senior first, shortfalls funded by a senior draw. NOK million.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var IDS = ['rev', 'm0', 'em', 'fee', 'sd', 'si', 'sa', 'jd', 'ji', 'sw', 'g', 'm1', 'cx', 'da', 'nwc', 'tax', 'n', 'xm'];
  var BASE = {};
  var charts = {};
  var f = function (v, d) { return (Math.abs(v) < 0.5 * Math.pow(10, -(d || 0)) ? 0 : v).toFixed(d == null ? 0 : d).replace('-', '−'); };
  var x = function (v) { return f(v, 1) + '×'; };
  var pct = function (v, d) { return isFinite(v) ? f(v * 100, d == null ? 1 : d) + '%' : 'n/a'; };

  function read() {
    var p = {};
    IDS.forEach(function (k) { p[k] = parseFloat($('l-' + k).value); });
    ['m0', 'fee', 'si', 'sa', 'ji', 'sw', 'g', 'm1', 'cx', 'da', 'nwc', 'tax'].forEach(function (k) { p[k] /= 100; });
    p.n = Math.max(1, Math.min(10, Math.round(p.n)));
    return p;
  }
  function valid(p) { return IDS.every(function (k) { return isFinite(p[k]); }) && p.rev > 0 && p.em > 0 && p.m0 > 0; }

  function model(p) {
    var e0 = p.rev * p.m0, ev0 = e0 * p.em, fees = ev0 * p.fee;
    var S = e0 * p.sd, J = e0 * p.jd, S0 = S, J0 = J;
    var eq0 = ev0 + fees - S - J;
    var cash = 0, losses = 0, rev = p.rev, rows = [];
    for (var t = 1; t <= p.n; t++) {
      var prev = rev; rev = prev * (1 + p.g);
      var m = p.m0 + (p.m1 - p.m0) * t / p.n;
      var ebitda = rev * m, da = rev * p.da, ebit = ebitda - da;
      var intS = S * p.si, intJ = J * p.ji, ebt = ebit - intS - intJ;
      var tax = 0;
      if (ebt <= 0) losses += -ebt;
      else { var used = Math.min(losses, ebt); losses -= used; tax = (ebt - used) * p.tax; }
      var ni = ebt - tax, capex = rev * p.cx, dnwc = (rev - prev) * p.nwc;
      var fcf = ni + da - capex - dnwc;
      var amort = Math.min(S0 * p.sa, S);
      var spare = fcf - amort, sweepS = 0, sweepJ = 0, draw = 0;
      S -= amort;
      if (spare >= 0) {
        var avail = spare * p.sw;
        sweepS = Math.min(avail, S); S -= sweepS; avail -= sweepS;
        sweepJ = Math.min(avail, J); J -= sweepJ; avail -= sweepJ;
        cash += avail + spare * (1 - p.sw); // what is not swept, or has no debt left to repay, stays as cash
      } else {
        var use = Math.min(cash, -spare); cash -= use; draw = -spare - use; S += draw;
      }
      rows.push({ t: t, rev: rev, ebitda: ebitda, m: m, da: da, ebit: ebit, interest: intS + intJ, tax: tax, ni: ni, capex: capex, dnwc: dnwc,
        fcf: fcf, amort: amort, sweep: sweepS + sweepJ, draw: draw, S: S, J: J, cash: cash, nd: S + J - cash, lev: (S + J - cash) / ebitda });
    }
    var last = rows[rows.length - 1];
    var ev1 = last.ebitda * p.xm, eq1 = ev1 - last.nd;
    var mom = eq1 / eq0, irr = eq1 <= 0 ? -1 : Math.pow(mom, 1 / p.n) - 1;
    return {
      e0: e0, ev0: ev0, fees: fees, S0: S0, J0: J0, eq0: eq0, rows: rows, ev1: ev1, eq1: eq1, mom: mom, irr: irr,
      bridge: { growth: (last.ebitda - e0) * p.em, multiple: (p.xm - p.em) * last.ebitda, paydown: (S0 + J0) - last.nd, fees: -fees }
    };
  }

  function kpi(box, label, value, note) {
    var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small');
    dt.textContent = label; dd.textContent = value; sm.textContent = note; dd.appendChild(sm); d.appendChild(dt); d.appendChild(dd); box.appendChild(d);
  }
  function table(el, head, rows, opts) {
    el.textContent = '';
    opts = opts || {};
    var th = document.createElement('thead'), tr = document.createElement('tr');
    head.forEach(function (h) { var c = document.createElement('th'); c.textContent = h; tr.appendChild(c); });
    th.appendChild(tr); el.appendChild(th);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var tr2 = document.createElement('tr');
      if (r.cls) tr2.className = r.cls;
      (r.cells || r).forEach(function (c) { var d = document.createElement('td'); d.textContent = c; tr2.appendChild(d); });
      tb.appendChild(tr2);
    });
    el.appendChild(tb);
  }

  function render() {
    var p = read();
    if (!valid(p)) { $('verdict').textContent = 'Fill in every field with a number.'; return; }
    var r = model(p), L = r.rows[r.rows.length - 1];
    if (r.eq0 <= 0) { $('verdict').textContent = 'The debt is larger than the price plus fees, so the fund puts in no equity. Lower the debt.'; return; }

    var b = r.bridge, gain = r.eq1 - r.eq0;
    var parts = [['EBITDA growth', b.growth], ['multiple expansion', b.multiple], ['debt paydown', b.paydown]].filter(function (q) { return q[1] > 0; });
    parts.sort(function (a, c) { return c[1] - a[1]; });
    $('verdict').textContent = r.eq1 <= 0
      ? 'The equity is wiped out: at exit the debt exceeds what TargetCo is worth.'
      : 'The fund puts in NOK ' + f(r.eq0) + ' million and gets ' + f(r.eq1) + ' million back after ' + p.n + ' years: an IRR of ' + pct(r.irr) +
        ' and ' + f(r.mom, 2) + ' times the money.' + (parts.length && gain > 0 ? ' The biggest driver is ' + parts[0][0] + '.' : '');

    var k = $('kpis'); k.textContent = '';
    kpi(k, 'IRR', pct(r.irr), r.irr >= 0.2 ? 'Meets a typical 20% target' : 'Below a typical 20% target');
    kpi(k, 'Money multiple', f(r.mom, 2) + '×', 'Equity out ÷ equity in');
    kpi(k, 'Equity in', f(r.eq0), pct(r.eq0 / (r.ev0 + r.fees), 0) + ' of the total price');
    kpi(k, 'Equity out', f(r.eq1), 'EV ' + f(r.ev1) + ' less net debt ' + f(L.nd));
    kpi(k, 'Leverage at exit', x(L.lev), 'Net debt ÷ EBITDA, from ' + x((r.S0 + r.J0) / r.e0));

    // bridge
    var bars = [{ label: 'Equity in', value: r.eq0, color: 1 }];
    var run = r.eq0;
    [['EBITDA growth', b.growth], ['Multiple', b.multiple], ['Debt paydown', b.paydown], ['Fees', b.fees]].forEach(function (q) {
      bars.push({ label: q[0], value: q[1], base: run, color: q[1] >= 0 ? 3 : 2, showSign: true });
      run += q[1];
    });
    bars.push({ label: 'Equity out', value: r.eq1, color: 1 });
    var cfgB = {
      label: 'Waterfall from equity invested to equity at exit', bars: bars, connect: true, format: function (v) { return f(v); },
      legend: [{ name: 'Equity', color: 1, square: true }, { name: 'Adds value', color: 3, square: true }, { name: 'Takes value', color: 2, square: true }]
    };
    if (charts.b) charts.b.update(cfgB); else charts.b = Charts.bars($('chart-bridge'), cfgB);

    var yrs = [0].concat(r.rows.map(function (q) { return q.t; }));
    var cfgD = {
      label: 'Senior and junior debt by year', x: yrs, xFormat: function (v) { return v === 0 ? 'Entry' : 'Y' + v; },
      xTicks: yrs, xTip: function (v) { return v === 0 ? 'At entry' : 'End of year ' + v; },
      yFormat: function (v) { return f(v); }, tipFormat: function (v) { return f(v); }, includeZero: true, height: 250,
      series: [
        { name: 'Senior loan', label: 'Senior', y: [r.S0].concat(r.rows.map(function (q) { return q.S; })), color: 1 },
        { name: 'Junior loan', label: 'Junior', y: [r.J0].concat(r.rows.map(function (q) { return q.J; })), color: 2 }
      ],
      tipExtra: function (i) {
        var lev = i === 0 ? (r.S0 + r.J0) / r.e0 : r.rows[i - 1].lev;
        return [{ name: 'Net debt ÷ EBITDA', value: x(lev), color: null }];
      }
    };
    if (charts.d) charts.d.update(cfgD); else charts.d = Charts.line($('chart-debt'), cfgD);

    // sources and uses
    var tot = r.ev0 + r.fees;
    table($('sources'), ['Sources', 'NOK m', 'Share'], [
      ['Senior loan', f(r.S0), pct(r.S0 / tot, 0)], ['Junior loan', f(r.J0), pct(r.J0 / tot, 0)], ['Fund equity', f(r.eq0), pct(r.eq0 / tot, 0)],
      { cls: 'hl', cells: ['Total', f(tot), '100%'] }]);
    table($('uses'), ['Uses', 'NOK m', 'Share'], [
      ['Buy the company (EV)', f(r.ev0), pct(r.ev0 / tot, 0)], ['Fees', f(r.fees), pct(r.fees / tot, 0)], ['', '', ''],
      { cls: 'hl', cells: ['Total', f(tot), '100%'] }]);

    // projections
    var head = [''].concat(r.rows.map(function (q) { return 'Year ' + q.t; }));
    var line = function (name, key, fn, cls) { return { cls: cls, cells: [name].concat(r.rows.map(function (q) { return fn ? fn(q) : f(q[key]); })) }; };
    table($('proj'), head, [
      line('Revenue', 'rev'),
      line('EBITDA', 'ebitda', null, 'hl'),
      line('EBITDA margin', null, function (q) { return pct(q.m); }),
      line('Depreciation', null, function (q) { return f(-q.da); }),
      line('Interest', null, function (q) { return f(-q.interest); }),
      line('Tax', null, function (q) { return f(-q.tax); }),
      line('Net income', 'ni'),
      line('+ Depreciation', 'da'),
      line('− Capex', null, function (q) { return f(-q.capex); }),
      line('− Working capital', null, function (q) { return f(-q.dnwc); }),
      line('Cash for lenders', 'fcf', null, 'hl'),
      line('Scheduled repayment', null, function (q) { return f(-q.amort); }),
      line('Early repayment', null, function (q) { return q.draw > 0 ? '+' + f(q.draw) + ' drawn' : f(-q.sweep); }),
      line('Senior loan', 'S'),
      line('Junior loan', 'J'),
      line('Cash', 'cash'),
      line('Net debt ÷ EBITDA', null, function (q) { return x(q.lev); }, 'hl')
    ]);

    // sensitivities
    heat($('sens-mult'), 'Entry ↓ / Exit →', [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(function (d) { return p.em + d; }), [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(function (d) { return p.xm + d; }),
      function (a, c) { return Object.assign({}, p, { em: a, xm: c }); }, x, x, p.em, p.xm);
    heat($('sens-lev'), 'Growth ↓ / Senior debt →', [-0.05, -0.025, 0, 0.025, 0.05].map(function (d) { return p.g + d; }), [-1, -0.5, 0, 0.5, 1].map(function (d) { return Math.max(0, p.sd + d); }),
      function (a, c) { return Object.assign({}, p, { g: a, sd: c }); }, function (v) { return pct(v, 1); }, x, p.g, p.sd);
  }

  function heat(el, corner, rowsV, colsV, mk, fr, fc, baseR, baseC) {
    var grid = rowsV.map(function (a) { return colsV.map(function (c) { var m = model(mk(a, c)); return m.eq0 > 0 ? m.irr : NaN; }); });
    var all = [].concat.apply([], grid).filter(isFinite);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    el.textContent = '';
    var th = document.createElement('thead'), tr = document.createElement('tr');
    var c0 = document.createElement('th'); c0.textContent = corner; tr.appendChild(c0);
    colsV.forEach(function (c) { var h = document.createElement('th'); h.textContent = fc(c); tr.appendChild(h); });
    th.appendChild(tr); el.appendChild(th);
    var tb = document.createElement('tbody');
    rowsV.forEach(function (a, i) {
      var r = document.createElement('tr'), h = document.createElement('th');
      h.scope = 'row'; h.textContent = fr(a); r.appendChild(h);
      colsV.forEach(function (c, j) {
        var d = document.createElement('td'), v = grid[i][j];
        d.textContent = isFinite(v) ? pct(v) : 'n/a';
        if (isFinite(v)) { d.dataset.v = v; d.style.setProperty('--w', Math.round(8 + 50 * (hi > lo ? (v - lo) / (hi - lo) : 0.5)) + '%'); }
        if (Math.abs(a - baseR) < 1e-9 && Math.abs(c - baseC) < 1e-9) d.className = 'base';
        r.appendChild(d);
      });
      tb.appendChild(r);
    });
    el.appendChild(tb);
  }

  IDS.forEach(function (k) { BASE[k] = $('l-' + k).value; $('l-' + k).addEventListener('input', render); });
  $('l-reset').addEventListener('click', function () { IDS.forEach(function (k) { $('l-' + k).value = BASE[k]; }); render(); });
  window.LBO = { model: model, read: read };
  render();
})();
