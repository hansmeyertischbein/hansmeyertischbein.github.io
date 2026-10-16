/* Forecasting risk on Oslo Børs: renders the walk-forward results (results/backtest.json)
 * and the monthly live forecasts (live/latest.json). All numbers are computed by the
 * Python pipeline in risk/pipeline; this file only formats and draws them.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = { EWMA: 'EWMA', HAR: 'HAR', LightGBM: 'LightGBM', RandomForest: 'Random forest', MLP: 'Neural network', ML: 'ML average',
    Logit: 'Logistic regression', ML_cal: 'ML average, recalibrated', VolLogit: 'Two-step (ML volatility → logit)' };
  var REF = { HAR: 1, EWMA: 1, Logit: 1 };
  var nf = function (v, d) { return v == null ? '–' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var pct = function (v, d) { return v == null ? '–' : nf(v * 100, d == null ? 1 : d) + '%'; };
  var pv = function (p) { return p == null ? '–' : p < 0.001 ? '< 0.001' : nf(p, 3); };
  var ym = function (s) { var a = s.split('-'); return +a[0] + (+a[1] - 1) / 12; };
  var monthName = function (s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };
  var longDate = function (s) { return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
  var yearFmt = function (v) { return String(Math.round(v)); };
  var monthTip = function (v) { var y = Math.floor(v + 1e-6), m = Math.round((v - y) * 12); return new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); };

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function table(t, head, rows) {
    t.innerHTML = '';
    var th = el('thead'), tr = el('tr');
    head.forEach(function (h, i) { tr.appendChild(el('th', { scope: 'col', class: i === 0 ? 'l' : '' }, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    rows.forEach(function (r) {
      var row = el('tr', r.cls ? { class: r.cls } : {});
      (r.cells || r).forEach(function (c, i) { row.appendChild(el('td', { class: i === 0 ? 'l' : '' }, c)); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
  }
  function li(ul, html) { ul.appendChild(el('li', {}, html)); }
  function get(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }

  /* ---------- results ---------- */
  function results(B) {
    var vol = {}, fall = {};
    B.vol.forEach(function (r) { vol[r.model] = r; });
    B.fall.forEach(function (r) { fall[r.model] = r; });
    var T = B.test, pf = B.portfolio.stats, boot = B.auc_vollogit_vs_logit, v = B.var.ML;
    $('meta-test').textContent = 'Test period ' + monthName(T.first_month) + ' – ' + monthName(T.last_month) + ' · ' + T.stocks + ' stocks';

    $('verdict').textContent = 'Partly. Machine learning forecasts next month’s volatility with ' + nf(vol.ML.r2_vs_har * 100, 0) +
      '% lower error than the best simple model, but trained directly on large falls it is no better than a logistic regression. Used in two steps, through its volatility forecast, it does help with falls too.';
    var k = [
      ['Volatility error vs HAR', '−' + nf(vol.ML.r2_vs_har * 100, 0) + '%', 'Diebold–Mariano p ' + pv(vol.ML.dm_p_mse_log)],
      ['Ranking of falls (AUC)', nf(fall.VolLogit.auc, 2), 'Two-step model, against ' + nf(fall.Logit.auc, 2) + ' for the reference'],
      ['VaR 95% exceeded', pct(v.rate, 1), 'of stock-months, 5% expected'],
      ['Low-risk portfolio volatility', pct(pf.low_ML.ann_vol, 1), 'against ' + pct(pf.osebx.ann_vol, 1) + ' for OSEBX']
    ];
    $('kpis').innerHTML = k.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '<small>' + x[2] + '</small></dd></div>'; }).join('');
    li($('wd-sum-ok'), 'Volatility: the tree models beat HAR clearly, in eleven of twelve years.');
    li($('wd-sum-ok'), 'Falls: the two-step model ranks risky stocks better than the reference at every threshold tested.');
    li($('wd-sum-ok'), 'The VaR is well calibrated, and a low-risk portfolio had lower volatility than OSEBX.');
    li($('wd-sum-no'), 'The neural network was no better than HAR.');
    li($('wd-sum-no'), 'Machine learning trained directly on falls lost to a two-variable logistic regression.');
    li($('wd-sum-no'), 'No model handled the Covid crash, and the low-risk portfolio earned less than the HAR version.');

    // volatility
    var order = ['EWMA', 'MLP', 'LightGBM', 'RandomForest', 'ML'];
    Charts.bars($('chart-vol'), {
      label: 'Change in forecast error against HAR by model', height: 250,
      format: function (x) { return nf(x, 0) + '%'; },
      bars: order.map(function (m) { var v = -vol[m].r2_vs_har * 100; return { label: NAMES[m], value: v, color: v < 0 ? 1 : 'muted', showSign: true, note: 'p ' + pv(vol[m].dm_p_mse_log) }; })
    });
    table($('vol-table'), ['Model', 'MSE', 'QLIKE', 'vs HAR', 'p-value', 'Rank corr.'],
      ['HAR', 'EWMA', 'LightGBM', 'RandomForest', 'MLP', 'ML'].map(function (m) {
        var r = vol[m];
        return { cls: REF[m] ? 'ref' : m === 'ML' ? 'hl' : '', cells: [NAMES[m] + (REF[m] ? ' (ref.)' : ''), nf(r.mse_log, 3), nf(r.qlike, 3),
          m === 'HAR' ? '–' : (r.r2_vs_har > 0 ? '−' : '+') + nf(Math.abs(r.r2_vs_har) * 100, 1) + '%', m === 'HAR' ? '–' : pv(r.dm_p_mse_log), nf(r.rank_corr, 2)] };
      }));
    var yrs = B.by_period.filter(function (r) { return /^\d{4}$/.test(r.period); });
    Charts.bars($('chart-years'), {
      label: 'Change in forecast error of the ML average against HAR by year', height: 240,
      format: function (x) { return nf(x, 0) + '%'; },
      bars: yrs.map(function (r) { var v = (r.mse_ML / r.mse_HAR - 1) * 100; return { label: "'" + r.period.slice(2), value: v, color: v < 0 ? 1 : 2, showSign: true, note: r.period + ': error ' + nf(r.mse_ML, 3) + ' against ' + nf(r.mse_HAR, 3) + ' for HAR' }; }),
      table: { head: ['Year', 'HAR', 'ML average', 'Change', 'Stock-months'], rows: yrs.map(function (r) { return [r.period, nf(r.mse_HAR, 3), nf(r.mse_ML, 3), pct(r.mse_ML / r.mse_HAR - 1, 1), nf(r.n, 0)]; }) }
    });

    // falls
    $('fall-rate').textContent = pct(T.fall_rate, 0);
    table($('fall-table'), ['Model', 'AUC', 'Brier skill', 'Top-10% hit rate'],
      ['Logit', 'LightGBM', 'RandomForest', 'MLP', 'ML', 'ML_cal', 'VolLogit'].map(function (m) {
        var r = fall[m];
        return { cls: REF[m] ? 'ref' : m === 'VolLogit' ? 'hl' : '', cells: [NAMES[m] + (REF[m] ? ' (ref.)' : ''), nf(r.auc, 3), pct(r.brier_skill, 1), pct(r.hit_rate_top10, 0)] };
      }));
    var bm = B.auc_ml_vs_logit;
    $('fall-boot').innerHTML = 'Is the difference real? A bootstrap that resamples whole months puts the two-step model’s AUC gain over the reference at ' +
      nf(boot.diff, 3) + ', with a 95% interval from ' + nf(boot.ci_low, 4) + ' to ' + nf(boot.ci_high, 3) + '. The interval only just excludes zero, so the gain is small but probably real. ' +
      'For the machine learning average trained directly on falls, the interval is ' + nf(bm.ci_low, 3) + ' to ' + nf(bm.ci_high, 3) + ': no evidence it beats the reference.';
    var cal = B.calibration.VolLogit, xs = cal.map(function (r, i) { return i + 1; });
    Charts.line($('chart-cal'), {
      label: 'Forecast and actual share of large falls by decile', x: xs, xTicks: xs, xFormat: function (x) { return 'D' + x; }, xTip: function (x) { return 'Decile ' + x + (x === 1 ? ' (safest)' : x === 10 ? ' (riskiest)' : ''); },
      yFormat: function (x) { return nf(x * 100, 0) + '%'; }, tipFormat: function (x) { return pct(x, 1); }, includeZero: true, height: 240,
      series: [{ name: 'Forecast', label: 'Forecast', y: cal.map(function (r) { return r.pred; }), color: 2 },
        { name: 'Actual', label: 'Actual', y: cal.map(function (r) { return r.actual; }), color: 'ink' }],
      table: { head: ['Decile', 'Forecast', 'Actual', 'Stock-months'], rows: cal.map(function (r, i) { return ['D' + (i + 1), pct(r.pred, 1), pct(r.actual, 1), nf(r.n, 0)]; }) }
    });
    table($('th-table'), ['Fall threshold', 'Base rate', 'AUC reference', 'AUC ML average', 'AUC two-step'],
      B.thresholds.map(function (r) { return { cls: r.threshold === 15 ? 'hl' : '', cells: [r.threshold + '%', pct(r.base_rate, 1), nf(r.auc_Logit, 3), nf(r.auc_ML, 3), nf(r.auc_VolLogit, 3)] }; }));

    // drivers
    ['vol', 'fall'].forEach(function (t) {
      var L = B.importance[t].slice(0, 10), max = L[0].share;
      $('imp-' + t).innerHTML = L.map(function (r) {
        return '<li><span>' + esc(r.label) + '</span><b>' + pct(r.share, 0) + '</b><i style="width:' + (r.share / max * 100).toFixed(1) + '%"></i></li>';
      }).join('');
    });

    // lookup
    var sel = $('look-sel'), tick = Object.keys(B.stocks).sort(function (a, b) { return B.stocks[a].name.localeCompare(B.stocks[b].name); });
    sel.innerHTML = tick.map(function (t) { return '<option value="' + t + '">' + esc(B.stocks[t].name) + ' (' + t + ')</option>'; }).join('');
    sel.value = B.stocks.EQNR ? 'EQNR' : tick[0];
    var look = null;
    function drawLook() {
      var s = B.stocks[sel.value], x = s.month.map(ym);
      var cfg = {
        label: 'Forecast and realised volatility for ' + s.name, x: x, xFormat: yearFmt, xTip: monthTip, height: 260, includeZero: true,
        yFormat: function (v) { return nf(v * 100, 0) + '%'; }, tipFormat: function (v) { return pct(v, 1); },
        series: [{ name: 'Realised', label: 'Realised', y: s.real, color: 'muted' }, { name: 'ML forecast', label: 'ML', y: s.ml, color: 1 },
          { name: 'HAR forecast', label: 'HAR', y: s.har, color: 2, dash: true }]
      };
      if (look) look.update(cfg); else look = Charts.line($('chart-look'), cfg);
      var e1 = 0, e2 = 0, n = 0, falls = 0;
      s.real.forEach(function (r, i) { if (r) { e1 += Math.pow(Math.log(r / s.ml[i]), 2); e2 += Math.pow(Math.log(r / s.har[i]), 2); n++; } falls += s.fell[i]; });
      $('look-note').textContent = s.name + ' (' + s.sector + '): ' + n + ' months in the test period, ' + falls + ' with a fall of 15% or more. Average error ' +
        nf(e1 / n, 3) + ' for the ML forecast and ' + nf(e2 / n, 3) + ' for HAR' + (e1 < e2 ? ', so machine learning did better for this stock.' : ', so HAR did better for this stock.');
    }
    sel.addEventListener('change', drawLook);
    drawLook();

    // portfolio
    var W = B.portfolio.wealth, xw = W.map(function (r) { return ym(r.month); });
    Charts.line($('chart-pf'), {
      label: 'Growth of NOK 1 in the low-risk portfolios and OSEBX', x: xw, xFormat: yearFmt, xTip: monthTip, height: 280,
      yFormat: function (v) { return nf(v, 1); }, tipFormat: function (v) { return 'NOK ' + nf(v, 2); },
      series: [{ name: 'Low risk, ML', label: 'Low risk (ML)', y: W.map(function (r) { return r.low_ML; }), color: 1 },
        { name: 'Low risk, HAR', label: 'Low risk (HAR)', y: W.map(function (r) { return r.low_HAR; }), color: 1, dash: true },
        { name: 'OSEBX', label: 'OSEBX', y: W.map(function (r) { return r.osebx; }), color: 'ink' },
        { name: 'High risk, ML', label: 'High risk', y: W.map(function (r) { return r.high_ML; }), color: 2 }]
    });
    var rows = [['low_ML', 'Low risk, ML'], ['low_HAR', 'Low risk, HAR'], ['osebx', 'OSEBX'], ['high_ML', 'High risk, ML'], ['equal_weight', 'All stocks, equal weight*']];
    table($('pf-table'), ['Portfolio', 'Return a year', 'Volatility', 'Sharpe', 'Worst fall'], rows.map(function (r) {
      var s = pf[r[0]];
      return { cls: r[0] === 'low_ML' ? 'hl' : '', cells: [r[1], pct(s.ann_return, 1), pct(s.ann_vol, 1), nf(s.sharpe, 2), pct(s.max_drawdown, 0)] };
    }));
    var P = B.portfolio;
    li($('wd-pf-ok'), 'Lower volatility than OSEBX (' + pct(pf.low_ML.ann_vol, 1) + ' against ' + pct(pf.osebx.ann_vol, 1) + ') with about the same Sharpe ratio, and the riskiest ten stocks did much worse, so the forecasts sort risk well.');
    li($('wd-pf-ok'), 'The ML version trades less than the HAR version (' + pct(P.turnover_ML, 0) + ' against ' + pct(P.turnover_HAR, 0) + ' of the portfolio a month) and had a smaller worst fall.');
    li($('wd-pf-no'), 'It earned less than the HAR version and did not beat OSEBX on return. Better risk forecasts help control risk; they are not a way to beat the market.');
    li($('wd-pf-no'), '*The equal-weighted average looks best, but it only contains companies that are still listed today. That is the survivorship bias, and the reason OSEBX is the fair comparison.');

    // VaR
    var h = B.var.HAR;
    $('var-text').textContent = 'A one-month 95% VaR for each stock, from the volatility forecast and the distribution of past forecast errors, was exceeded in ' + pct(v.rate, 2) +
      ' of ' + nf(v.n, 0) + ' stock-months, against 5% expected (Kupiec test p = ' + nf(v.kupiec_p, 2) + ', so no evidence of miscalibration). HAR gives ' + pct(h.rate, 2) +
      '. Exceedances cluster in crises: in ' + v.months_over_20pct + ' of ' + v.months + ' months more than a fifth of the stocks breached their VaR at the same time.';

    $('m-universe').textContent = 'Each month end, stocks with ' + B.data.universe_rule;
    $('m-avg').textContent = nf(T.avg_stocks_per_month, 0);
    $('m-stocks').textContent = T.stocks;
    var cc = B.crosscheck_euronext || {}, ck = Object.keys(cc);
    $('m-data').textContent = 'Cleaning removed ' + nf(B.data.dropped_zero_volume, 0) + ' days without trading and ' + B.data.dropped_spikes + ' reversed price spike. ' +
      (ck.length ? 'Over about two years, closes for ' + ck.filter(function (t) { return cc[t].days_diff_over_1pct === 0; }).length + ' of ' + ck.length + ' large stocks were within 1% of Euronext’s own closes on every day; all but one day were identical.' : '');
  }

  /* ---------- live ---------- */
  function live(L) {
    var off = L.official;
    $('now-status').innerHTML = (off ? '<strong>Official forecasts</strong> made at the close on ' + longDate(L.as_of) + '.'
      : '<strong>Preview</strong> from prices up to ' + longDate(L.as_of) + '. Mid-month previews are not part of the track record; the official forecasts are made at the last close of each month.') +
      ' ' + L.stocks.length + ' stocks. The models were trained on data up to ' + monthName(L.train_last_month) + '.';
    var sectors = Array.from(new Set(L.stocks.map(function (s) { return s.sector; }))).sort();
    $('now-sector').innerHTML += sectors.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    var maxV = Math.max.apply(null, L.stocks.map(function (s) { return s.vol_ml; })), maxF = Math.max.apply(null, L.stocks.map(function (s) { return s.fall_prob; }));
    var picks = {};
    L.portfolio.forEach(function (t) { picks[t] = 1; });
    var all = false, SHOW = 12;
    var more = el('button', { type: 'button', class: 'btn more-row' });
    $('now-table').parentNode.insertAdjacentElement('afterend', more);
    more.addEventListener('click', function () { all = !all; draw(); });
    function draw() {
      var sec = $('now-sector').value, q = $('now-find').value.trim().toLowerCase();
      var rows = L.stocks.filter(function (s) { return (!sec || s.sector === sec) && (!q || s.name.toLowerCase().indexOf(q) >= 0 || s.ticker.toLowerCase().indexOf(q) >= 0); });
      var n = rows.length;
      more.hidden = n <= SHOW;
      more.textContent = all ? 'Show fewer' : 'Show all ' + n + ' stocks';
      if (!all) rows = rows.slice(0, SHOW);
      var tb = $('now-table').tBodies[0];
      tb.innerHTML = rows.length ? rows.map(function (s) {
        return '<tr><td><span class="nm">' + esc(s.name) + (picks[s.ticker] ? '<span class="pick" title="In the low-risk portfolio">●</span>' : '') + '</span><span class="sub">' + s.ticker + ' · ' + esc(s.sector) + '</span></td>' +
          '<td><span class="cellbar"><span>' + pct(s.vol_ml, 0) + '</span><i style="width:' + (s.vol_ml / maxV * 100).toFixed(0) + '%"></i></span></td>' +
          '<td><span class="cellbar fall"><span>' + pct(s.fall_prob, 1) + '</span><i style="width:' + (s.fall_prob / maxF * 100).toFixed(0) + '%"></i></span></td>' +
          '<td>' + pct(s.var95_1m, 1) + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="empty">No stocks match.</td></tr>';
    }
    $('now-sector').addEventListener('change', draw);
    $('now-find').addEventListener('input', draw);
    draw();

    var body = $('track-body');
    if (!L.track || !L.track.length) {
      body.innerHTML = '<p class="empty">No month has been scored yet. The first official forecasts are made at the close on the last trading day of October 2026, and they are scored once November is over.</p>';
    } else {
      var t = el('table', { class: 'data-table track-table' });
      var wrap = el('div', { class: 'table-wrap' }); wrap.appendChild(t); body.appendChild(wrap);
      table(t, ['Forecast made', 'Stocks', 'Error ML', 'Error HAR', 'ML better for', 'Falls (expected)', 'VaR breaches (expected)'], L.track.slice().reverse().map(function (s) {
        return [monthName(s.month), s.n, nf(s.mse_ml, 3), nf(s.mse_har, 3), pct(s.ml_better_share, 0) + ' of stocks', s.falls + ' (' + nf(s.expected_falls, 1) + ')', s.var_hits + ' (' + nf(s.expected_var_hits, 1) + ')'];
      }));
      if (L.portfolio_track && L.portfolio_track.length) {
        var last = L.portfolio_track[L.portfolio_track.length - 1];
        body.appendChild(el('p', {}, 'Live low-risk portfolio since ' + longDate(L.portfolio_track[0].formed) + ': ' + pct(last.cum, 1) + ', against ' + pct(last.cum_osebx, 1) + ' for OSEBX, before trading costs.'));
      }
    }
  }

  /* ---------- glossary: closed by default, opened by a tap or by a link to a term ---------- */
  (function glossary() {
    var box = $('glossary-box'), find = $('gl-find');
    if (!box) return;
    function openFor(hash) {
      if (!hash) return;
      var id = hash.slice(1), t = id === 'glossary' ? box : document.getElementById(id);
      if (!t || !box.contains(t) && t !== box) return;
      box.open = true;
      requestAnimationFrame(function () { t.scrollIntoView({ block: 'start' }); });
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (h === '#glossary' || /^#g-/.test(h)) { box.open = true; }
    });
    window.addEventListener('hashchange', function () { openFor(location.hash); });
    openFor(location.hash);
    var sub = box.querySelector('.g-sub');
    box.addEventListener('toggle', function () { sub.textContent = 'Every term on this page explained in plain words. Tap to ' + (box.open ? 'close.' : 'open.'); });
    var items = Array.prototype.slice.call(box.querySelectorAll('dl > div'));
    find.addEventListener('input', function () {
      var q = find.value.trim().toLowerCase(), shown = 0;
      items.forEach(function (d) { var hit = !q || d.textContent.toLowerCase().indexOf(q) >= 0; d.hidden = !hit; if (hit) shown++; });
      box.querySelectorAll('.g-body h3').forEach(function (h) {
        var dl = h.nextElementSibling, any = Array.prototype.some.call(dl.children, function (c) { return !c.hidden; });
        h.hidden = dl.hidden = !any;
      });
      $('gl-none').hidden = shown > 0;
    });
  })();

  get('results/backtest.json').then(results).catch(function (e) { $('verdict').textContent = 'The results could not be loaded.'; console.error(e); });
  get('live/latest.json').then(live).catch(function (e) { $('now-status').textContent = 'The forecasts could not be loaded.'; console.error(e); });
})();
