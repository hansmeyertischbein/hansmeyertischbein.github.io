/* Taylor rule for Norges Bank.
 * Reads data.json (built by tools/build_taylor.py from Norges Bank and Statistics Norway
 * figures) and draws the rule against the actual policy rate.
 *
 * Rule:      i = r* + pi + a (pi - pi*) + b y
 * Smoothed:  i_t = rho * actual_{t-1} + (1 - rho) * rule_t
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DEF = { r: 1, a: 0.5, b: 0.5, rho: 0, gap: 'gap' };
  var P = Object.assign({}, DEF);
  var D = null, charts = {};

  var pct = function (v, d) { return (d == null ? v.toFixed(2) : v.toFixed(d)).replace('-', '−') + '%'; };
  var num = function (v, d) { return v.toFixed(d == null ? 2 : d).replace('-', '−'); };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) { var p = iso.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function monthName(ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function qLabel(q) { return 'Q' + q.slice(-1) + ' ' + q.slice(0, 4); }
  function qx(q) { return +q.slice(0, 4) + (+q.slice(-1) - 1) / 4; }

  // Output gap for each quarter; the newest quarter can lack GDP, so it carries the last known gap
  function gaps(key) {
    var out = [], last = null;
    D.quarters.forEach(function (r) {
      if (r[key] != null) { last = r[key]; out.push({ v: r[key], carried: false }); }
      else out.push({ v: last, carried: true });
    });
    return out;
  }

  function rule(p, rStar) {
    var g = gaps(p.gap);
    return D.quarters.map(function (r, i) {
      var raw = rStar + r.cpi + p.a * (r.cpi - r.target) + p.b * g[i].v;
      if (p.rho > 0 && i > 0) raw = p.rho * D.quarters[i - 1].rate + (1 - p.rho) * raw;
      return raw;
    });
  }

  function syncOutputs() {
    $('o-r').textContent = pct(P.r);
    $('o-a').textContent = num(P.a, 1);
    $('o-b').textContent = num(P.b, 1);
    $('o-rho').textContent = num(P.rho, 1);
    document.querySelectorAll('[data-gap]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.gap === P.gap)); });
  }

  function render() {
    syncOutputs();
    var Q = D.quarters, x = Q.map(function (r) { return qx(r.q); });
    var nb = D.norges_bank;
    var main = rule(P, P.r), lo = rule(P, nb.neutral_real_rate_low), hi = rule(P, nb.neutral_real_rate_high);
    var g = gaps(P.gap);
    var actual = Q.map(function (r) { return r.rate; });
    var n = Q.length - 1;

    // headline
    var L = D.latest, diff = actual[n] - main[n];
    var word = Math.abs(diff) < 0.13 ? 'close to' : diff > 0 ? 'above' : 'below';
    $('verdict').textContent = 'With these settings the rule points to ' + pct(main[n], 2) + ' for ' + qLabel(Q[n].q) +
      '. Norges Bank’s policy rate is ' + pct(L.policy_rate, 2) + ', ' +
      (word === 'close to' ? 'close to the rule.' : num(Math.abs(diff), 2) + ' points ' + word + ' it.');

    var kp = $('kpis'); kp.textContent = '';
    [
      ['Policy rate', pct(L.policy_rate, 2), 'Since ' + longDate(L.policy_rate_date)],
      ['Taylor rule, ' + qLabel(Q[n].q), pct(main[n], 2), 'Range ' + pct(Math.min(lo[n], hi[n]), 2) + ' to ' + pct(Math.max(lo[n], hi[n]), 2) + ' across the neutral range'],
      ['CPI-ATE', pct(L.cpi, 1), monthName(L.cpi_month) + ', 12-month rise. Target ' + pct(Q[n].target, 0)],
      ['Output gap', pct(g[n].v, 1), g[n].carried ? 'Estimate for ' + qLabel(L.gdp_quarter) + ', the latest GDP quarter' : 'Estimate for ' + qLabel(Q[n].q)]
    ].forEach(function (k) {
      var d = document.createElement('div');
      var dt = document.createElement('dt'); dt.textContent = k[0];
      var dd = document.createElement('dd'); dd.textContent = k[1];
      var sm = document.createElement('small'); sm.textContent = k[2]; dd.appendChild(sm);
      d.appendChild(dt); d.appendChild(dd); kp.appendChild(d);
    });

    var xTicks = []; for (var y = +Q[0].q.slice(0, 4); y <= +Q[n].q.slice(0, 4); y++) xTicks.push(y);
    var fmtYear = function (v) { return String(Math.round(v)); };
    var tipX = function (v, i) { return qLabel(Q[i].q); };
    var table = {
      summary: 'Show the numbers as a table',
      head: ['Quarter', 'Policy rate', 'Taylor rule', 'CPI-ATE', 'Target', 'Output gap'],
      rows: Q.map(function (r, i) {
        return [qLabel(r.q), num(r.rate), num(main[i]), num(r.cpi), num(r.target, 1), g[i].v == null ? 'n/a' : num(g[i].v) + (g[i].carried ? '*' : '')];
      }).reverse()
    };

    var cfgMain = {
      label: 'Line chart of Norges Bank’s policy rate and the Taylor rule by quarter from 2015',
      x: x, xTicks: xTicks, xFormat: fmtYear, xTip: tipX,
      yFormat: function (v) { return num(v, Math.abs(v) % 1 ? 1 : 0) + '%'; },
      tipFormat: function (v) { return pct(v, 2); },
      includeZero: true,
      series: [
        { name: 'Policy rate', label: 'Policy rate', y: actual, color: 1, step: true },
        { name: 'Taylor rule', label: 'Taylor rule', y: main, color: 2 }
      ],
      bands: [{ lo: lo, hi: hi, color: 2 }],
      tipExtra: function (i) {
        return [{ name: 'Shaded band', value: num(Math.min(lo[i], hi[i])) + '–' + num(Math.max(lo[i], hi[i])), color: null }];
      },
      table: table
    };
    if (charts.main) charts.main.update(cfgMain); else charts.main = Charts.line($('chart-main'), cfgMain);
    $('chart-note').textContent = 'Policy rate at the end of each quarter. ' + qLabel(Q[n].q) + ' uses the output gap for ' + qLabel(L.gdp_quarter) +
      ' until Statistics Norway publishes GDP for the quarter. An asterisk in the table marks that.';

    var cfgCpi = {
      label: 'CPI-ATE inflation and the inflation target by quarter',
      x: x, xFormat: fmtYear, xTip: tipX, height: 220,
      yFormat: function (v) { return num(v, 0) + '%'; }, tipFormat: function (v) { return pct(v, 1); },
      includeZero: true,
      series: [
        { name: 'CPI-ATE', label: 'CPI-ATE', y: Q.map(function (r) { return r.cpi; }), color: 1 },
        { name: 'Target', label: 'Target', y: Q.map(function (r) { return r.target; }), color: 'muted', dash: true, step: true }
      ]
    };
    if (charts.cpi) charts.cpi.update(cfgCpi); else charts.cpi = Charts.line($('chart-cpi'), cfgCpi);

    var cfgGap = {
      label: 'Estimated output gap by quarter',
      x: x, xFormat: fmtYear, xTip: tipX, height: 220,
      yFormat: function (v) { return num(v, 0) + '%'; }, tipFormat: function (v) { return pct(v, 1); },
      series: [{ name: 'Output gap', label: false, y: g.map(function (o) { return o.carried ? null : o.v; }), color: 3 }],
      hrefs: []
    };
    if (charts.gap) charts.gap.update(cfgGap); else charts.gap = Charts.line($('chart-gap'), cfgGap);
  }

  function decisionsTable() {
    var tb = document.querySelector('#decisions tbody');
    var dec = D.decisions.slice().reverse().slice(0, 14);
    var all = D.decisions;
    dec.forEach(function (d) {
      var i = all.indexOf(d), prev = i > 0 ? all[i - 1].rate : null;
      var tr = document.createElement('tr');
      [longDate(d.date), pct(d.rate, 2), prev == null ? '' : (d.rate - prev > 0 ? '+' : '−') + Math.abs(d.rate - prev).toFixed(2)].forEach(function (c) {
        var td = document.createElement('td'); td.textContent = c; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var today = new Date().toISOString().slice(0, 10);
    var next = D.norges_bank.next_meetings.filter(function (d) { return d >= today; });
    $('next-meetings').textContent = 'Only changes are listed. Next decisions: ' + next.slice(0, 4).map(longDate).join(', ') + '. The page is updated the same day.';
    if (next.length) $('m-next').textContent = 'Next update: ' + longDate(next[0]);
    $('m-updated').textContent = 'Updated after the decision of ' + longDate(D.norges_bank.decision_date) + '. CPI-ATE to ' + monthName(D.latest.cpi_month) + ', GDP to ' + qLabel(D.latest.gdp_quarter) + '.';
  }

  function bind() {
    [['c-r', 'r'], ['c-a', 'a'], ['c-b', 'b'], ['c-rho', 'rho']].forEach(function (p) {
      $(p[0]).addEventListener('input', function (e) { P[p[1]] = parseFloat(e.target.value); render(); });
    });
    document.querySelectorAll('[data-gap]').forEach(function (b) {
      b.addEventListener('click', function () { P.gap = b.dataset.gap; render(); });
    });
    $('reset').addEventListener('click', function () {
      P = Object.assign({}, DEF);
      $('c-r').value = P.r; $('c-a').value = P.a; $('c-b').value = P.b; $('c-rho').value = P.rho;
      render();
    });
  }

  fetch('data.json?v=' + Date.now().toString().slice(0, -5))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { D = d; bind(); render(); decisionsTable(); })
    .catch(function () { $('verdict').textContent = 'The data could not be loaded. Try reloading the page.'; });
})();
