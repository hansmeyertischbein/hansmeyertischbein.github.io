/* Bonds and the yield curve.
 * yields.json holds Norges Bank's generic yields on Norwegian government securities.
 * The calculator prices a fixed-rate bond on a coupon date with one flat yield.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var Y = null, charts = {};
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var f = function (v, d) { return v.toFixed(d == null ? 2 : d).replace('-', '−'); };
  var pct = function (v, d) { return f(v, d) + '%'; };
  function longDate(iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function shortDate(iso) { var p = iso.split('-'); return +p[2] + ' ' + MON[+p[1] - 1]; }
  function days(iso) { return Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5); }
  function td(tr, text) { var c = document.createElement('td'); c.textContent = text; tr.appendChild(c); return c; }

  /* ---------- bond maths ---------- */
  function bond(c, n, y, m) {
    var per = Math.round(n * m), cpn = c / m, r = y / 100 / m;
    var P = 0, D = 0, K = 0, flows = [];
    for (var k = 1; k <= per; k++) {
      var cf = cpn + (k === per ? 100 : 0);
      var pv = cf / Math.pow(1 + r, k);
      P += pv; D += (k / m) * pv; K += cf * k * (k + 1) / Math.pow(1 + r, k + 2);
      flows.push({ t: k / m, cf: cf, pv: pv });
    }
    D /= P;
    return { P: P, mac: D, mod: D / (1 + r), conv: K / (P * m * m), flows: flows };
  }
  function interp(t) {
    var M = Y.maturities, C = Y.curves[latestDate()];
    if (t <= M[0]) return C[0];
    if (t >= M[M.length - 1]) return C[C.length - 1];
    for (var i = 1; i < M.length; i++) if (t <= M[i]) return C[i - 1] + (C[i] - C[i - 1]) * (t - M[i - 1]) / (M[i] - M[i - 1]);
  }
  function latestDate() { return Object.keys(Y.curves).sort().pop(); }

  /* ---------- yield curve ---------- */
  function curve() {
    var dates = Object.keys(Y.curves).sort().reverse(); // newest first
    var L = Y.curves[dates[0]], M = Y.maturities;
    var top = 0; L.forEach(function (v, i) { if (v > L[top]) top = i; });
    var spread = L[L.length - 1] - L[0];
    $('curve-verdict').textContent = 'On ' + longDate(dates[0]) + ' the curve was humped: yields rise from ' + pct(L[0], 2) + ' at 3 months to ' +
      pct(L[top], 2) + ' at ' + Y.maturity_labels[top] + ', then fall to ' + pct(L[L.length - 1], 2) + ' at 10 years. ' +
      'The market expects rates to stay high for a while and then come down.';
    var cols = [1, 2, 3];
    var series = dates.map(function (d, i) {
      return { name: longDate(d) + (d === '2026-09-22' ? ', before the hike' : ''), label: shortDate(d), y: Y.curves[d], color: cols[i], dash: i === 2 };
    });
    var cfg = {
      label: 'Norwegian government yield curve on three dates',
      x: M, xTicks: [0.25, 1, 3, 5, 7, 10],
      xFormat: function (v) { return v < 1 ? Math.round(v * 12) + 'm' : v + 'y'; },
      xTip: function (v, i) { return Y.maturity_labels[i]; },
      yFormat: function (v) { return f(v, Math.abs(v * 10 % 1) > 0.01 ? 2 : 1) + '%'; },
      tipFormat: function (v) { return pct(v, 3); },
      series: series,
      hrefs: [{ y: Y.policy_rate, label: 'Policy rate ' + pct(Y.policy_rate, 2), atX: 1.3, below: true }],
      table: {
        head: ['Maturity'].concat(dates.map(shortDate)).concat(['Change since ' + shortDate(dates[1])]),
        rows: M.map(function (m, i) {
          return [Y.maturity_labels[i]].concat(dates.map(function (d) { return f(Y.curves[d][i], 3); }))
            .concat([(Y.curves[dates[0]][i] - Y.curves[dates[1]][i] >= 0 ? '+' : '−') + Math.abs(Y.curves[dates[0]][i] - Y.curves[dates[1]][i]).toFixed(3)]);
        })
      }
    };
    charts.curve = Charts.line($('chart-curve'), cfg);

    var box = $('curve-text');
    var p1 = document.createElement('p');
    var d1 = dates[1], ch3m = (L[0] - Y.curves[d1][0]) * 100, ch10 = (L[6] - Y.curves[d1][6]) * 100;
    p1.textContent = 'Since ' + longDate(d1) + ', two days before Norges Bank raised the policy rate to 4.50%, the 3-month yield has risen by ' +
      Math.round(ch3m) + ' basis points and the 10-year by ' + Math.round(ch10) + '. The whole curve moved up, so the market priced a higher path for rates, not only for the next quarter.';
    var p2 = document.createElement('p');
    p2.textContent = 'The gap between the 10-year and 3-month yields is ' + Math.round(spread * 100) + ' basis points. A flat or falling long end usually means the market expects lower short rates later. Norges Bank’s own forecast in September was for the policy rate to stay at about 4.5% for a time and then fall gradually towards 3.5%. Long yields also carry a term premium, so the curve is not a pure forecast.';
    box.appendChild(p1); box.appendChild(p2);
  }

  function timeChart() {
    var D = Y.daily, x = D.map(function (r) { return days(r.date); });
    var first = D[0].date, last = D[D.length - 1].date;
    var ticks = [], y0 = +first.slice(0, 4), m0 = +first.slice(5, 7);
    for (var y = y0, m = m0 + 1; ; m++) {
      if (m > 12) { m = 1; y++; }
      var iso = y + '-' + String(m).padStart(2, '0') + '-01';
      if (iso > last) break;
      ticks.push(days(iso));
    }
    var label = function (v) { var d = new Date(v * 864e5); return MON[d.getUTCMonth()]; };
    var cfg = {
      label: 'Daily 3-month and 10-year Norwegian government yields',
      x: x, xTicks: ticks, xFormat: label,
      xTip: function (v, i) { return longDate(D[i].date); },
      yFormat: function (v) { return f(v, 1) + '%'; }, tipFormat: function (v) { return pct(v, 3); },
      series: [
        { name: '3-month bill', label: '3 months', y: D.map(function (r) { return r.m3; }), color: 1 },
        { name: '10-year bond', label: '10 years', y: D.map(function (r) { return r.y10; }), color: 2 }
      ],
      refs: Y.decisions.map(function (d) { return { x: days(d.date), label: '' }; }),
      tipExtra: function (i) {
        var dd = Y.decisions.filter(function (d) { return d.date === D[i].date; });
        return dd.length ? [{ name: 'Norges Bank: ' + dd[0].label, value: '', color: null }] : [];
      },
      table: {
        head: ['Date', '3 months', '12 months', '5 years', '10 years'],
        rows: D.slice().reverse().map(function (r) { return [longDate(r.date), f(r.m3, 3), f(r.m12, 3), f(r.y5, 3), f(r.y10, 3)]; })
      }
    };
    charts.time = Charts.line($('chart-time'), cfg);
  }

  /* ---------- calculator ---------- */
  function read() {
    return { c: parseFloat($('b-c').value), n: parseFloat($('b-n').value), y: parseFloat($('b-y').value), m: parseInt($('b-m').value, 10) };
  }
  function setYieldFromCurve() {
    var n = parseFloat($('b-n').value);
    if (!(n > 0)) return;
    $('b-y').value = interp(n).toFixed(3);
    $('b-y-hint').textContent = n > 10 ? 'The curve stops at 10 years, so this is the 10-year yield.' : 'Norwegian government yield for ' + n + ' years on ' + longDate(latestDate()) + '.';
  }
  function calc() {
    var p = read();
    if (!(p.n >= 1 && p.n <= 50) || !(p.c >= 0) || !isFinite(p.y) || p.y <= -50) { $('b-verdict').textContent = 'Fill in a coupon, a maturity between 1 and 50 years and a yield.'; return; }
    var b = bond(p.c, p.n, p.y, p.m);
    var dv01 = b.mod * b.P * 0.0001;
    var out = $('b-out'); out.textContent = '';
    [
      ['Price', f(b.P, 2), b.P > 100.005 ? 'Above par: coupon above yield' : b.P < 99.995 ? 'Below par: coupon below yield' : 'At par'],
      ['Macaulay duration', f(b.mac, 2), 'Years, weighted by present value'],
      ['Modified duration', f(b.mod, 2), '% price change for 1 point in yield'],
      ['Convexity', f(b.conv, 1), 'Years²'],
      ['DV01', f(dv01, 4), 'NOK per 100 face, per 0.01 point']
    ].forEach(function (k) {
      var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small');
      dt.textContent = k[0]; dd.textContent = k[1]; sm.textContent = k[2]; dd.appendChild(sm); d.appendChild(dt); d.appendChild(dd); out.appendChild(d);
    });
    var up = bond(p.c, p.n, p.y + 1, p.m).P;
    $('b-verdict').textContent = 'If yields rise by 1 point overnight, the price falls from ' + f(b.P) + ' to ' + f(up) + ', a loss of ' +
      f((1 - up / b.P) * 100, 1) + '%. A holder of NOK 10 million face value would lose about NOK ' +
      Math.round((b.P - up) / 100 * 1e7).toLocaleString('en-GB').replace(/,/g, ' ') + '.';

    // shocks
    var tb = document.querySelector('#b-shocks tbody'); tb.textContent = '';
    [-200, -100, -50, -25, 25, 50, 100, 200].forEach(function (bp) {
      var dy = bp / 10000, np = bond(p.c, p.n, p.y + bp / 100, p.m).P;
      var exact = (np / b.P - 1) * 100, dur = -b.mod * dy * 100, dc = (-b.mod * dy + 0.5 * b.conv * dy * dy) * 100;
      var tr = document.createElement('tr');
      td(tr, (bp > 0 ? '+' : '−') + Math.abs(bp) + ' bp');
      td(tr, f(np));
      [exact, dur, dc].forEach(function (v) { td(tr, (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%'); });
      tb.appendChild(tr);
    });
    // cash flows
    var cb = document.querySelector('#b-cf tbody'); cb.textContent = '';
    var rows = b.flows;
    var show = rows.length <= 20 ? rows : rows.filter(function (r, i) { return i < 5 || i >= rows.length - 3; });
    show.forEach(function (r, i) {
      if (rows.length > 20 && i === 5) { var g = document.createElement('tr'); td(g, '…'); [1, 2, 3, 4].forEach(function () { td(g, ''); }); cb.appendChild(g); }
      var tr = document.createElement('tr');
      td(tr, f(r.t, r.t % 1 ? 2 : 0)); td(tr, f(r.cf)); td(tr, f(r.pv)); td(tr, f(r.pv / b.P * 100, 1) + '%'); td(tr, f(r.t * r.pv / b.P, 3));
      cb.appendChild(tr);
    });
    var tot = document.createElement('tr'); tot.className = 'hl';
    td(tot, 'Total'); td(tot, f(rows.reduce(function (a, r) { return a + r.cf; }, 0))); td(tot, f(b.P)); td(tot, '100.0%'); td(tot, f(b.mac, 3));
    cb.appendChild(tot);

    // price-yield chart
    var xs = [], ex = [], du = [], dc2 = [];
    var lo = Math.max(p.y - 4, -1), hi = p.y + 4;
    for (var yv = lo; yv <= hi + 1e-9; yv += 0.1) {
      var dyy = (yv - p.y) / 100;
      xs.push(+yv.toFixed(2));
      ex.push(bond(p.c, p.n, yv, p.m).P);
      du.push(b.P * (1 - b.mod * dyy));
      dc2.push(b.P * (1 - b.mod * dyy + 0.5 * b.conv * dyy * dyy));
    }
    var cfg = {
      label: 'Bond price against yield, with duration and convexity approximations',
      x: xs, xFormat: function (v) { return f(v, 0) + '%'; }, xTip: function (v) { return 'Yield ' + pct(v, 2); },
      yFormat: function (v) { return f(v, 0); }, tipFormat: function (v) { return f(v, 2); },
      series: [
        { name: 'True price', label: 'True price', y: ex, color: 1 },
        { name: 'Duration only', label: 'Duration', y: du, color: 2, dash: true },
        { name: 'Duration and convexity', label: '+ convexity', y: dc2, color: 3, dash: true }
      ],
      dots: [{ x: p.y, y: b.P, color: 'ink', label: f(b.P, 2) + ' at ' + pct(p.y, 2), anchor: p.y > (lo + hi) / 2 ? 'end' : 'start', dy: -10 }]
    };
    if (charts.py) charts.py.update(cfg); else charts.py = Charts.line($('chart-py'), cfg);
  }

  function bind() {
    ['b-c', 'b-y', 'b-m'].forEach(function (id) { $(id).addEventListener('input', function () { if (id === 'b-y') $('b-y-hint').textContent = 'Your own yield.'; calc(); }); });
    $('b-n').addEventListener('input', function () { setYieldFromCurve(); calc(); });
    $('b-reset').addEventListener('click', function () { setYieldFromCurve(); calc(); });
  }

  fetch('yields.json?v=1').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
    Y = d;
    $('m-data').textContent = 'Yields from Norges Bank, latest ' + longDate(latestDate());
    curve(); timeChart(); setYieldFromCurve(); bind(); calc();
  }).catch(function (e) { $('curve-verdict').textContent = 'The yield data could not be loaded. Try reloading the page.'; console.error(e); });
})();
