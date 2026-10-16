/* Short yesterday's big winners: compounds the daily trades in trades.json (built by reversal.py).
 * A stock that rose at least the threshold on day 0 is shorted at day 1's open and bought back at
 * day 1's close; the money is split equally between the day's shorts, and days without a signal are
 * in cash. Each candidate is stored as [ticker, day-0 return, day-1 open-to-close return].
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var D = null, chart = null, useCost = true;
  var nf = function (v, d) { return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var pct = function (v, d) { return (v < 0 ? '−' : '') + nf(Math.abs(v) * 100, d == null ? 1 : d) + '%'; };
  var spct = function (v, d) { return (v > 0 ? '+' : '') + pct(v, d); };
  var sgn = function (v) { return (v < 0 ? '−' : '') + nf(Math.abs(v), 2); };
  var toX = function (s) { var a = s.split('-'); return +a[0] + (+a[1] - 1) / 12 + (+a[2] - 1) / 365; };
  var day = function (s) { return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  var name = function (t) { return D.names[t] || t; };
  function cost() { var v = parseFloat(String($('cost').value).replace(',', '.')); return useCost && isFinite(v) && v >= 0 ? v / 100 : 0; }

  // daily return on the capital for threshold th and cost c per transaction
  function run(th, c) {
    var g = [], picks = [];
    D.days.forEach(function (d) {
      var s = d.c.filter(function (x) { return x[1] >= th; });
      picks.push(s);
      g.push(s.length ? -s.reduce(function (a, x) { return a + x[2]; }, 0) / s.length - 2 * c : 0);
    });
    var w = [], v = 1;
    g.forEach(function (x) { v *= 1 + x; w.push(v); });
    var tr = g.filter(function (x, i) { return picks[i].length; });
    var m = g.reduce(function (a, b) { return a + b; }, 0) / g.length;
    var sd = Math.sqrt(g.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (g.length - 1));
    var peak = 1, mdd = 0;
    w.forEach(function (x) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); });
    var gross = tr.length ? tr.reduce(function (a, b) { return a + b; }, 0) / tr.length + 2 * c : 0;
    return { g: g, w: w, picks: picks, total: v - 1, ann: Math.pow(v, 1 / 5) - 1, vol: sd * Math.sqrt(252), sharpe: sd ? m / sd * Math.sqrt(252) : 0, mdd: mdd,
      days: tr.length, shorts: picks.reduce(function (a, s) { return a + s.length; }, 0), hit: tr.length ? tr.filter(function (x) { return x > 0; }).length / tr.length : 0,
      avg: tr.length ? tr.reduce(function (a, b) { return a + b; }, 0) / tr.length : 0, breakeven: gross / 2 };
  }
  function table(t, head, rows) {
    t.innerHTML = '<thead><tr>' + head.map(function (h, i) { return '<th scope="col"' + (i ? '' : ' class="l"') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + (r.cells || r).map(function (c, i) { return '<td' + (i ? '' : ' class="l"') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  function osebx() {
    var ob = {}, last = null;
    D.osebx.forEach(function (o) { ob[o.d] = o.v; });
    return D.days.map(function (d) { if (ob[d.e] != null) last = ob[d.e]; else if (ob[d.d] != null && last == null) last = ob[d.d]; return last || 1; });
  }

  function render() {
    var th = +$('th').value / 100, c = cost();
    $('th-out').textContent = $('th').value + '%';
    document.querySelectorAll('.th-val').forEach(function (e) { e.textContent = $('th').value + '%'; });
    document.querySelectorAll('[data-cost]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.cost === '1') === useCost)); });
    $('cost').disabled = !useCost;
    var R = run(th, c), G = run(th, 0), obw = osebx();
    var obTotal = obw[obw.length - 1] - 1;
    $('verdict').textContent = (c > 0 ? 'With ' + nf(c * 100, 2) + '% per transaction, ' : 'Before costs, ') + 'shorting stocks that rose at least ' + $('th').value + '% ' +
      (R.total > 0 ? 'turned NOK 1 into NOK ' + nf(1 + R.total, 2) : 'lost ' + pct(-R.total, 0) + ' of the money') + ' over the five years, against NOK ' + nf(1 + obTotal, 2) + ' for OSEBX. ' +
      'It traded on ' + R.days + ' of ' + D.days.length + ' days.';
    var k = [
      ['Total return', spct(R.total, 0), spct(R.ann, 1) + ' a year'],
      ['Trading days', nf(R.days, 0), nf(R.shorts, 0) + ' shorts in all'],
      ['Hit rate', pct(R.hit, 0), 'of trading days made money'],
      ['Worst fall', pct(R.mdd, 0), '']
    ];
    var obPeak = 1, obMdd = 0;
    obw.forEach(function (v) { obPeak = Math.max(obPeak, v); obMdd = Math.min(obMdd, v / obPeak - 1); });
    k[3][2] = 'from a peak; OSEBX ' + pct(obMdd, 0);
    $('kpis').innerHTML = k.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '<small>' + x[2] + '</small></dd></div>'; }).join('');

    var x = D.days.map(function (d) { return toX(d.e); });
    var series = [{ name: c > 0 ? 'After costs' : 'Strategy', label: c > 0 ? 'After costs' : 'Strategy', y: R.w, color: 1 }];
    if (c > 0) series.push({ name: 'Before costs', label: 'Before costs', y: G.w, color: 1, dash: true });
    series.push({ name: 'OSEBX', label: 'OSEBX', y: obw, color: 'ink' });
    var cfg = {
      label: 'Growth of NOK 1 for the strategy and OSEBX, log scale', x: x, xFormat: function (v) { return String(Math.round(v)); },
      xTip: function (v, i) { return day(D.days[i].e); }, height: 300,
      yFormat: function (v) { var a = Math.pow(10, v); return nf(a, a < 10 ? 1 : 0); }, tipFormat: function (v) { return 'NOK ' + nf(Math.pow(10, v), 2); },
      series: series.map(function (s) { return { name: s.name, label: s.label, y: s.y.map(function (v) { return Math.log10(v); }), color: s.color, dash: s.dash }; }),
      hrefs: [{ y: 0, label: 'Start', align: 'end', below: true }],
      tipExtra: function (i) { var p = R.picks[i]; return [{ name: p.length ? 'Shorted: ' + p.map(function (q) { return q[0]; }).join(', ') : 'No trade', value: '', color: null }]; }
    };
    if (chart) chart.update(cfg); else chart = Charts.line($('chart'), cfg);

    var yrs = {};
    D.days.forEach(function (d, i) { var y = d.d.slice(0, 4); (yrs[y] = yrs[y] || []).push(i); });
    table($('years'), ['Year', 'Strategy', 'Trading days', 'Hit rate', 'OSEBX'], Object.keys(yrs).sort().map(function (y) {
      var idx = yrs[y], v = 1, n = 0, hit = 0;
      idx.forEach(function (i) { v *= 1 + R.g[i]; if (R.picks[i].length) { n++; if (R.g[i] > 0) hit++; } });
      var o0 = idx[0] ? obw[idx[0] - 1] : 1, o1 = obw[idx[idx.length - 1]];
      return [y, spct(v - 1, 0), n, n ? pct(hit / n, 0) : '–', spct(o1 / o0 - 1, 0)];
    }));
    table($('ths'), ['Rise on day 0', 'Trading days', 'Shorts', 'Avg. day, before costs', 'Total, before costs', 'Total, with costs'], [3, 5, 7, 10, 15].map(function (t) {
      var a = run(t / 100, 0), b = run(t / 100, c);
      return { cls: t === +$('th').value ? 'hl' : '', cells: ['≥ ' + t + '%', a.days, a.shorts, spct(a.avg, 2), spct(a.total, 0), c > 0 ? spct(b.total, 0) : '–'] };
    }));
    $('breakeven').textContent = 'Before costs, the average trading day earned ' + spct(G.avg, 2) + '. With two transactions per stock, the strategy breaks even at about ' +
      nf(G.breakeven * 100, 2) + '% per transaction. Below that it makes money, above it loses. That is the number to compare with what trading actually costs:';
    var mAll = D.days.reduce(function (a, d) { return a + d.m; }, 0) / D.days.length;
    $('drift').textContent = 'The profit is not just a general tendency for prices to fall during the day. Across all eligible stocks, the average open-to-close move was ' +
      spct(mAll, 2) + '; the stocks that had just jumped fell ' + pct(G.avg, 2) + ' on average on their trading days. That fits a known pattern: after a big jump, part of it is often given back the next day, especially in small and volatile stocks.';
    fragility(G);
    var L = [];
    for (var i = D.days.length - 1; i >= 0 && L.length < 10; i--) if (R.picks[i].length) L.push(i);
    table($('last'), ['Traded', 'Shorted (rise on day 0)', 'Day’s result'], L.map(function (i) {
      return [day(D.days[i].e), R.picks[i].map(function (q) { return name(q[0]) + ' <span class="sub">+' + nf(q[1] * 100, 1) + '%</span>'; }).join(', '), spct(R.g[i], 2)];
    }));
  }

  function fragility(G) {
    var g = G.g.slice().sort(function (a, b) { return b - a; });
    var wo = g.slice(10).reduce(function (a, x) { return a * (1 + x); }, 1) - 1;
    var yr = {};
    D.days.forEach(function (d, i) { var y = d.d.slice(0, 4); yr[y] = (yr[y] || 1) * (1 + G.g[i]); });
    var bestY = Object.keys(yr).sort(function (a, b) { return yr[b] - yr[a]; })[0];
    $('fragile').textContent = 'Before costs, the strategy made ' + spct(G.total, 0) + '. Without its ten best days it would have made ' + spct(wo, 0) +
      (wo > 0 ? ', so it does not hang on a few lucky days. ' : ', so a few lucky days carry the whole result. ') +
      'The best year was ' + bestY + ' (' + spct(yr[bestY] - 1, 0) + ')' + (bestY === '2021' ? ', a year of extreme moves in small growth stocks' : '') + '. The stocks shorted most often:';
    var per = {};
    G.picks.forEach(function (s) { s.forEach(function (q) { (per[q[0]] = per[q[0]] || []).push(-q[2]); }); });
    var top = Object.keys(per).sort(function (a, b) { return per[b].length - per[a].length; }).slice(0, 8);
    table($('freq'), ['Stock', 'Times shorted', 'Average result', 'Share that made money'], top.map(function (t) {
      var v = per[t], m = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
      return [name(t) + ' <span class="sub">' + t + '</span>', v.length, spct(m, 2), pct(v.filter(function (x) { return x > 0; }).length / v.length, 0)];
    }));
  }

  document.querySelectorAll('[data-cost]').forEach(function (b) { b.addEventListener('click', function () { useCost = b.dataset.cost === '1'; render(); }); });
  $('cost').addEventListener('input', render);
  $('th').addEventListener('input', render);
  fetch('trades.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    $('universe-note').textContent += ' On average ' + nf(D.avg_eligible, 0) + ' stocks qualified each day.';
    render();
  }).catch(function (e) { $('verdict').textContent = 'The data could not be loaded.'; console.error(e); });
})();
