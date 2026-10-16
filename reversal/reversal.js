/* Daily reversal on Oslo Børs: compounds the trades from trades.json (built by reversal.py)
 * with the chosen trading cost. Each trade: half the money long yesterday's biggest loser,
 * half short yesterday's biggest winner, entered at the open. Exit rules: 0 = close the same
 * day, 1 = open the next day, 2 = close five trading days later (six overlapping tranches).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RULES = ['Close same day', 'Open next day', 'Close after a week'];
  var SHORT = ['Same-day close', 'Next open', 'One week'];
  var HOLD = 6;                      // tranches for the weekly rule: entry day plus five trading days
  var D = null, chart = null, useCost = true;
  var nf = function (v, d) { return Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var pct = function (v, d) { return (v < 0 ? '−' : '') + nf(Math.abs(v) * 100, d == null ? 1 : d) + '%'; };
  var sgn = function (v) { return (v < 0 ? '−' : '') + nf(Math.abs(v), 2); };
  var spct = function (v, d) { return (v > 0 ? '+' : '') + pct(v, d); };
  var toX = function (s) { var a = s.split('-'); return +a[0] + (+a[1] - 1) / 12 + (+a[2] - 1) / 365; };
  var name = function (t) { return (D.names[t] || t); };
  function cost() { var v = parseFloat(String($('cost').value).replace(',', '.')); return useCost && isFinite(v) && v >= 0 ? v / 100 : 0; }

  // per-trade return on the capital: half long, half short, minus four transactions on half the capital each
  function tradeRet(t, k, c) { return 0.5 * t.l[k] - 0.5 * t.s[k] - 2 * c; }

  function series(k, c) {
    var T = D.trades, n = T.length, w = [], g = T.map(function (t) { return tradeRet(t, k, c); });
    if (k < 2) {
      var v = 1;
      for (var i = 0; i < n; i++) { v *= 1 + g[i]; w.push(v); }
    } else {
      // six interleaved sequences, each with a sixth of the money; a trade counts once it has closed
      var seq = [1, 1, 1, 1, 1, 1];
      for (var j = 0; j < n; j++) {
        var done = j - (HOLD - 1);
        if (done >= 0) seq[done % HOLD] *= 1 + g[done];
        w.push(seq.reduce(function (a, b) { return a + b; }, 0) / HOLD);
      }
      // the last open trades close after the period
      for (var r = Math.max(0, n - (HOLD - 1)); r < n; r++) seq[r % HOLD] *= 1 + g[r];
      w[n - 1] = seq.reduce(function (a, b) { return a + b; }, 0) / HOLD;
    }
    return { w: w, g: g };
  }
  function stats(w, g, years) {
    var dr = w.map(function (v, i) { return i ? v / w[i - 1] - 1 : v - 1; });
    var m = dr.reduce(function (a, b) { return a + b; }, 0) / dr.length;
    var sd = Math.sqrt(dr.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (dr.length - 1));
    var peak = 1, mdd = 0;
    w.forEach(function (v) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); });
    var end = w[w.length - 1];
    return { total: end - 1, ann: Math.pow(end, 1 / years) - 1, vol: sd * Math.sqrt(252), sharpe: sd ? m / sd * Math.sqrt(252) : 0, mdd: mdd,
      hit: g ? g.filter(function (x) { return x > 0; }).length / g.length : null, avg: g ? g.reduce(function (a, b) { return a + b; }, 0) / g.length : null };
  }
  function table(t, head, rows) {
    t.innerHTML = '<thead><tr>' + head.map(function (h, i) { return '<th scope="col"' + (i ? '' : ' class="l"') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + (r.cells || r).map(function (c, i) { return '<td' + (i ? '' : ' class="l"') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }

  function render() {
    var c = cost(), years = 5;
    document.querySelectorAll('[data-cost]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.cost === '1') === useCost)); });
    $('cost').disabled = !useCost;
    var S = [0, 1, 2].map(function (k) { return series(k, c); });
    var st = S.map(function (s) { return stats(s.w, s.g, years); });
    // OSEBX on the same dates
    var ob = {}, last = null;
    D.osebx.forEach(function (o) { ob[o.d] = o.v; });
    var obw = D.trades.map(function (t) { if (ob[t.d] != null) last = ob[t.d]; return last; });
    var obs = stats(obw.map(function (v) { return v || 1; }), null, years);
    var best = st.map(function (s, k) { return [s.total, k]; }).sort(function (a, b) { return b[0] - a[0]; })[0][1];
    var beat = st.filter(function (s) { return s.total > obs.total; }).length;
    $('verdict').textContent = (c > 0 ? 'With ' + nf(c * 100, 2) + '% per transaction, ' : 'Before costs, ') +
      (st[best].total > 0 ? 'the best exit rule is “' + RULES[best].toLowerCase() + '”, which turned NOK 1 into NOK ' + nf(1 + st[best].total, 2) + '. '
        : 'every exit rule loses money; the least bad is “' + RULES[best].toLowerCase() + '” at ' + pct(st[best].total, 0) + '. ') +
      (beat ? beat + ' of 3 rules beat' : 'None of the rules beat') + ' simply holding OSEBX (' + spct(obs.total, 0) + ').';

    var x = D.trades.map(function (t) { return toX(t.d); });
    var cfg = {
      label: 'Growth of NOK 1 for the three exit rules and OSEBX', x: x, xFormat: function (v) { return String(Math.round(v)); },
      xTip: function (v, i) { return new Date(D.trades[i].d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); },
      height: 300, yFormat: function (v) { return nf(v, v < 10 ? 1 : 0); }, tipFormat: function (v) { return 'NOK ' + nf(v, 2); },
      series: [{ name: RULES[0], label: SHORT[0], y: S[0].w, color: 1 }, { name: RULES[1], label: SHORT[1], y: S[1].w, color: 2 },
        { name: RULES[2], label: SHORT[2], y: S[2].w, color: 3 }, { name: 'OSEBX', label: 'OSEBX', y: obw, color: 'ink', dash: true }],
      hrefs: [{ y: 1, label: 'Start', align: 'end', below: true }]
    };
    if (chart) chart.update(cfg); else chart = Charts.line($('chart'), cfg);

    table($('stats'), ['Exit rule', 'Total', 'A year', 'Volatility', 'Sharpe', 'Worst fall', 'Hit rate', 'Avg. trade'],
      st.map(function (s, k) { return { cls: k === best ? 'hl' : '', cells: ['<span class="rk r' + (k + 1) + '">' + (k + 1) + '</span>' + RULES[k], spct(s.total, 0), spct(s.ann, 1), pct(s.vol, 0), sgn(s.sharpe), pct(s.mdd, 0), pct(s.hit, 0), spct(s.avg, 2)] }; })
        .concat([{ cls: 'ref', cells: ['OSEBX, buy and hold', spct(obs.total, 0), spct(obs.ann, 1), pct(obs.vol, 0), sgn(obs.sharpe), pct(obs.mdd, 0), '–', '–'] }]));

    // year by year: compound the trades signalled in each year
    var yrs = {};
    D.trades.forEach(function (t, i) { var y = t.d.slice(0, 4); (yrs[y] = yrs[y] || []).push(i); });
    var ylist = Object.keys(yrs).sort();
    table($('years'), ['Year', RULES[0], RULES[1], RULES[2], 'OSEBX'], ylist.map(function (y) {
      var idx = yrs[y];
      var cells = [0, 1, 2].map(function (k) {
        if (k < 2) return spct(idx.reduce(function (a, i) { return a * (1 + S[k].g[i]); }, 1) - 1, 0);
        var seq = [1, 1, 1, 1, 1, 1];
        idx.forEach(function (i, n) { seq[n % HOLD] *= 1 + S[2].g[i]; });
        return spct(seq.reduce(function (a, b) { return a + b; }, 0) / HOLD - 1, 0);
      });
      var o0 = idx[0] ? obw[idx[0] - 1] : 1, o1 = obw[idx[idx.length - 1]];
      return [y].concat(cells, [spct(o1 / (o0 || 1) - 1, 0)]);
    }));

    // legs, before costs
    var legs = [0, 1, 2].map(function (k) {
      var n = D.trades.length, L = 0, Sh = 0;
      D.trades.forEach(function (t) { L += t.l[k]; Sh -= t.s[k]; });
      return [L / n, Sh / n];
    });
    table($('legs'), ['Exit rule', 'Long the loser', 'Short the winner', 'Trade, before costs'], legs.map(function (l, k) {
      return ['<span class="rk r' + (k + 1) + '">' + (k + 1) + '</span>' + RULES[k], spct(l[0], 2), spct(l[1], 2), spct(0.5 * l[0] + 0.5 * l[1], 2)];
    }));
    $('legs-text').textContent = 'The idea that losers bounce back does not hold up: on average the loser kept falling after it was bought, under every exit rule. ' +
      'All the profit came from the short side, where yesterday’s winner gave back part of its gain. That is the opposite of a symmetric reversal, and it means the strategy is really a bet that big jumps fade.';
  }

  function fragility() {
    var g = D.trades.map(function (t) { return tradeRet(t, 0, 0); }).sort(function (a, b) { return b - a; });
    var all = g.reduce(function (a, x) { return a * (1 + x); }, 1) - 1;
    var wo = g.slice(10).reduce(function (a, x) { return a * (1 + x); }, 1) - 1;
    $('fragile').textContent = 'Before costs, the same-day rule made ' + spct(all, 0) + ' over the five years. Without its ten best trades, out of ' + nf(D.trades.length, 0) +
      ', it would have made ' + spct(wo, 0) + '. A few very large moves, several of them in Norwegian Air Shuttle during its restructuring in 2021, decide much of the result. The same stocks turn up again and again:';
    var cnt = {};
    D.trades.forEach(function (t) { cnt[t.L] = cnt[t.L] || { l: 0, s: 0 }; cnt[t.S] = cnt[t.S] || { l: 0, s: 0 }; cnt[t.L].l++; cnt[t.S].s++; });
    var top = Object.keys(cnt).sort(function (a, b) { return (cnt[b].l + cnt[b].s) - (cnt[a].l + cnt[a].s); }).slice(0, 6);
    table($('freq'), ['Stock', 'Days bought as the loser', 'Days shorted as the winner', 'Share of all picks'], top.map(function (t) {
      return [name(t) + ' <span class="sub">' + t + '</span>', cnt[t].l, cnt[t].s, pct((cnt[t].l + cnt[t].s) / (2 * D.trades.length), 0)];
    }));
    var L = D.trades.slice(-10).reverse();
    table($('last'), ['Signal day', 'Bought (fell)', 'Shorted (rose)', 'Same-day trade'], L.map(function (t) {
      var fd = new Date(t.d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      return [fd, name(t.L) + ' <span class="sub">' + pct(t.Lr, 1) + '</span>', name(t.S) + ' <span class="sub">' + spct(t.Sr, 1) + '</span>', spct(tradeRet(t, 0, 0), 2)];
    }));
    $('universe-note').textContent += ' On average ' + nf(D.avg_eligible, 0) + ' stocks qualified each day, from ' + D.stocks.length + ' that were picked at least once.';
    $('meta').textContent = new Date(D.start).getFullYear() + '–' + new Date(D.end).getFullYear() + ', ' + nf(D.trades.length, 0) + ' trading days';
  }

  document.querySelectorAll('[data-cost]').forEach(function (b) { b.addEventListener('click', function () { useCost = b.dataset.cost === '1'; render(); }); });
  $('cost').addEventListener('input', render);
  fetch('trades.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { D = d; fragility(); render(); })
    .catch(function (e) { $('verdict').textContent = 'The data could not be loaded.'; console.error(e); });
})();
