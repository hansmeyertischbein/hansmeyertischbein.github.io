/* Option pricing: Black-Scholes-Merton with a continuous dividend yield, Greeks,
 * and a Cox-Ross-Rubinstein binomial tree for European and American options.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var type = 'call', greek = 'delta', charts = {};
  var f = function (v, d) { return v.toFixed(d == null ? 2 : d).replace('-', '−'); };

  // Standard normal CDF via erfc (Numerical Recipes erfcc, relative error below 1.2e-7)
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
      t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function N(x) { return 0.5 * erfc(-x / Math.SQRT2); }
  function n(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }

  function bs(p, S) {
    S = S == null ? p.S : S;
    var sT = p.v * Math.sqrt(p.T);
    var d1 = (Math.log(S / p.K) + (p.r - p.q + p.v * p.v / 2) * p.T) / sT, d2 = d1 - sT;
    var dq = Math.exp(-p.q * p.T), dr = Math.exp(-p.r * p.T);
    var call = S * dq * N(d1) - p.K * dr * N(d2), put = p.K * dr * N(-d2) - S * dq * N(-d1);
    var g = {
      call: call, put: put, d1: d1, d2: d2,
      delta: type === 'call' ? dq * N(d1) : dq * (N(d1) - 1),
      gamma: dq * n(d1) / (S * sT),
      vega: S * dq * n(d1) * Math.sqrt(p.T) / 100,
      theta: (type === 'call'
        ? -S * dq * n(d1) * p.v / (2 * Math.sqrt(p.T)) - p.r * p.K * dr * N(d2) + p.q * S * dq * N(d1)
        : -S * dq * n(d1) * p.v / (2 * Math.sqrt(p.T)) + p.r * p.K * dr * N(-d2) - p.q * S * dq * N(-d1)) / 365,
      rho: (type === 'call' ? p.K * p.T * dr * N(d2) : -p.K * p.T * dr * N(-d2)) / 100
    };
    g.price = type === 'call' ? call : put;
    return g;
  }

  function tree(p, steps, american, isPut) {
    var dt = p.T / steps, u = Math.exp(p.v * Math.sqrt(dt)), d = 1 / u;
    var pu = (Math.exp((p.r - p.q) * dt) - d) / (u - d), disc = Math.exp(-p.r * dt);
    var V = new Float64Array(steps + 1);
    var pay = function (s) { return Math.max(isPut ? p.K - s : s - p.K, 0); };
    for (var j = 0; j <= steps; j++) V[j] = pay(p.S * Math.pow(u, 2 * j - steps));
    for (var i = steps - 1; i >= 0; i--) {
      for (j = 0; j <= i; j++) {
        var cont = disc * (pu * V[j + 1] + (1 - pu) * V[j]);
        V[j] = american ? Math.max(cont, pay(p.S * Math.pow(u, 2 * j - i))) : cont;
      }
    }
    return { value: V[0], u: u, d: d, p: pu };
  }

  function read() {
    return {
      S: parseFloat($('o-S').value), K: parseFloat($('o-K').value), T: parseFloat($('o-T').value),
      r: parseFloat($('o-r').value) / 100, v: parseFloat($('o-v').value) / 100, q: parseFloat($('o-q').value || 0) / 100,
      n: Math.max(1, Math.min(1000, Math.round(parseFloat($('o-n').value))))
    };
  }
  function valid(p) { return p.S > 0 && p.K > 0 && p.T > 0 && p.v > 0 && isFinite(p.r) && isFinite(p.q) && p.n >= 1; }
  function kpi(box, label, value, note) {
    var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small');
    dt.textContent = label; dd.textContent = value; sm.textContent = note; dd.appendChild(sm); d.appendChild(dt); d.appendChild(dd); box.appendChild(d);
  }
  function td(tr, t, tag) { var c = document.createElement(tag || 'td'); c.textContent = t; tr.appendChild(c); return c; }

  function render() {
    document.querySelectorAll('[data-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.type === type)); });
    document.querySelectorAll('[data-g]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.g === greek)); });
    var p = read();
    if (!valid(p)) { $('verdict').textContent = 'Fill in positive values for share price, strike, time and volatility.'; return; }
    var isPut = type === 'put', g = bs(p);
    var eu = tree(p, p.n, false, isPut), am = tree(p, p.n, true, isPut);
    var intrinsic = Math.max(isPut ? p.K - p.S : p.S - p.K, 0);
    var name = isPut ? 'put' : 'call';
    var probITM = isPut ? N(-g.d2) : N(g.d2);
    $('verdict').textContent = 'The ' + name + ' is worth ' + f(g.price) + ' by Black–Scholes: ' + f(intrinsic) + ' in intrinsic value and ' +
      f(g.price - intrinsic) + ' in time value. Under risk-neutral pricing the chance it ends in the money is ' + Math.round(probITM * 100) + '%.';

    var box = $('prices'); box.textContent = '';
    kpi(box, 'Black–Scholes', f(g.price), 'European ' + name);
    kpi(box, 'Binomial, European', f(eu.value), p.n + ' steps, off by ' + f(Math.abs(eu.value - g.price), 4));
    kpi(box, 'Binomial, American', f(am.value), am.value - eu.value > 0.00005 ? 'Early exercise adds ' + f(am.value - eu.value, 3) : 'Early exercise adds nothing');
    var parity = g.call - g.put - (p.S * Math.exp(-p.q * p.T) - p.K * Math.exp(-p.r * p.T));
    kpi(box, 'Put–call parity', Math.abs(parity) < 1e-6 ? 'Holds' : f(parity, 6), 'Call ' + f(g.call) + ', put ' + f(g.put));

    // Greeks table
    var tb = document.querySelector('#greeks tbody'); tb.textContent = '';
    [
      ['Delta', f(g.delta, 3), 'The option gains about ' + f(Math.abs(g.delta)) + ' when the share ' + (g.delta >= 0 ? 'rises' : 'falls') + ' by 1. Hedge with ' + f(Math.abs(g.delta) * 100, 0) + ' shares per 100 options.'],
      ['Gamma', f(g.gamma, 4), 'Delta changes by ' + f(g.gamma, 4) + ' for each 1 move in the share.'],
      ['Vega', f(g.vega, 3), 'The price rises by ' + f(g.vega) + ' if volatility rises by 1 point.'],
      ['Theta', f(g.theta, 4), 'The option loses about ' + f(Math.abs(g.theta), 3) + ' a day if nothing else changes.'],
      ['Rho', f(g.rho, 3), 'The price ' + (g.rho >= 0 ? 'rises' : 'falls') + ' by ' + f(Math.abs(g.rho)) + ' if the interest rate rises by 1 point.']
    ].forEach(function (r) { var tr = document.createElement('tr'); td(tr, r[0]); td(tr, r[1]); var c = td(tr, r[2]); c.style.whiteSpace = 'normal'; c.style.textAlign = 'left'; c.style.minWidth = '14rem'; tb.appendChild(tr); });

    // value vs share price
    var xs = [], val = [], pay = [], gs = [];
    var lo = Math.max(0.01, p.K * 0.5), hi = p.K * 1.5;
    for (var i = 0; i <= 100; i++) {
      var s = lo + (hi - lo) * i / 100; xs.push(s);
      var b = bs(p, s); val.push(b.price); pay.push(Math.max(isPut ? p.K - s : s - p.K, 0)); gs.push(b[greek]);
    }
    var cfgV = {
      label: 'Option value today and payoff at expiry against the share price',
      x: xs, xFormat: function (v) { return f(v, 0); }, xTip: function (v) { return 'Share price ' + f(v); },
      yFormat: function (v) { return f(v, 0); }, tipFormat: function (v) { return f(v); },
      includeZero: true,
      series: [
        { name: 'Value today', label: 'Today', y: val, color: 1 },
        { name: 'Payoff at expiry', label: 'At expiry', y: pay, color: 2, dash: true }
      ],
      refs: [{ x: p.K, label: 'Strike' }],
      dots: [{ x: p.S, y: g.price, color: 'ink', label: f(g.price), anchor: isPut ? 'start' : 'end', dy: -10 }]
    };
    if (charts.v) charts.v.update(cfgV); else charts.v = Charts.line($('chart-value'), cfgV);
    var gName = { delta: 'Delta', gamma: 'Gamma', vega: 'Vega, per 1 point of volatility', theta: 'Theta, per day' }[greek];
    var gd = { delta: 2, gamma: 3, vega: 2, theta: 3 }[greek];
    var cfgG = {
      label: gName + ' against the share price', height: 220,
      x: xs, xFormat: function (v) { return f(v, 0); }, xTip: function (v) { return 'Share price ' + f(v); },
      yFormat: function (v) { return f(v, gd); }, tipFormat: function (v) { return f(v, gd + 1); },
      includeZero: true,
      series: [{ name: gName, label: false, y: gs, color: 3 }],
      refs: [{ x: p.K, label: 'Strike' }],
      dots: [{ x: p.S, y: g[greek], color: 'ink' }]
    };
    if (charts.g) charts.g.update(cfgG); else charts.g = Charts.line($('chart-greek'), cfgG);

    // convergence
    var ns = [], ce = [], ca = [], cb = [];
    for (var k = 5; k <= 200; k++) { ns.push(k); ce.push(tree(p, k, false, isPut).value); ca.push(tree(p, k, true, isPut).value); cb.push(g.price); }
    var cfgC = {
      label: 'Binomial price against number of steps', x: ns, xFormat: function (v) { return f(v, 0); }, xTip: function (v) { return v + ' steps'; },
      yFormat: function (v) { return f(v, 2); }, tipFormat: function (v) { return f(v, 4); },
      series: [
        { name: 'Binomial, European', label: 'European', y: ce, color: 1 },
        { name: 'Binomial, American', label: 'American', y: ca, color: 2 },
        { name: 'Black–Scholes', label: 'Black–Scholes', y: cb, color: 'muted', dash: true }
      ]
    };
    if (charts.c) charts.c.update(cfgC); else charts.c = Charts.line($('chart-conv'), cfgC);

    drawTree(p, isPut);
  }

  // A three-step American tree for the same option, laid out as a triangle
  function drawTree(p, isPut) {
    var steps = 3, dt = p.T / steps, u = Math.exp(p.v * Math.sqrt(dt)), d = 1 / u;
    var pu = (Math.exp((p.r - p.q) * dt) - d) / (u - d), disc = Math.exp(-p.r * dt);
    var pay = function (s) { return Math.max(isPut ? p.K - s : s - p.K, 0); };
    var S = [], V = [], ex = [];
    for (var i = 0; i <= steps; i++) { S[i] = []; V[i] = []; ex[i] = []; for (var j = 0; j <= i; j++) S[i][j] = p.S * Math.pow(u, j) * Math.pow(d, i - j); }
    for (j = 0; j <= steps; j++) V[steps][j] = pay(S[steps][j]);
    for (i = steps - 1; i >= 0; i--) for (j = 0; j <= i; j++) {
      var cont = disc * (pu * V[i + 1][j + 1] + (1 - pu) * V[i + 1][j]);
      var e = pay(S[i][j]);
      ex[i][j] = e > cont + 1e-9; V[i][j] = Math.max(cont, e);
    }
    $('tree-note').textContent = 'American ' + (isPut ? 'put' : 'call') + ', three steps of ' + f(dt * 12, 1) + ' months. u = ' + f(u, 4) + ', d = ' + f(d, 4) +
      ', risk-neutral probability of an up move p = ' + f(pu, 4) + '. Each cell shows the share price and, below it, the option value. Bold marks nodes where exercising early is best.';
    var t = $('tree'); t.textContent = '';
    var head = document.createElement('thead'), hr = document.createElement('tr');
    for (i = 0; i <= steps; i++) td(hr, i === 0 ? 'Now' : 'Step ' + i, 'th');
    head.appendChild(hr); t.appendChild(head);
    var body = document.createElement('tbody');
    for (var row = 0; row <= 2 * steps; row++) {
      var tr = document.createElement('tr');
      for (i = 0; i <= steps; i++) {
        var up = steps - row; // height above the middle
        var jj = (i + up) / 2;
        var cell = document.createElement('td');
        if (Math.abs(up) <= i && Number.isInteger(jj)) {
          cell.textContent = f(S[i][jj]);
          var v = document.createElement('div'); v.textContent = f(V[i][jj]);
          v.style.color = 'var(--muted)';
          if (ex[i][jj]) { v.style.fontWeight = '600'; v.style.color = 'var(--ink)'; }
          cell.appendChild(v);
        }
        tr.appendChild(cell);
      }
      body.appendChild(tr);
    }
    t.appendChild(body);
  }

  function checks() {
    var save = type, rows = [];
    type = 'call';
    var a = bs({ S: 42, K: 40, T: 0.5, r: 0.1, v: 0.2, q: 0 });
    rows.push(['European call, S 42, K 40, 6 months, r 10%, σ 20%', '4.76', f(a.call, 4)]);
    rows.push(['European put, same inputs', '0.81', f(a.put, 4)]);
    var am = tree({ S: 50, K: 50, T: 5 / 12, r: 0.1, v: 0.4, q: 0 }, 5, true, true);
    rows.push(['American put, S 50, K 50, 5 months, r 10%, σ 40%, 5 steps', '4.49', f(am.value, 4)]);
    type = save;
    var tb = document.querySelector('#checks tbody');
    rows.forEach(function (r) { var tr = document.createElement('tr'); var c = td(tr, r[0]); c.style.whiteSpace = 'normal'; c.style.minWidth = '14rem'; td(tr, r[1]); td(tr, r[2]); tb.appendChild(tr); });
  }

  function load(v) { Object.keys(v).forEach(function (k) { $('o-' + k).value = v[k]; }); render(); }
  ['o-S', 'o-K', 'o-T', 'o-r', 'o-v', 'o-q', 'o-n'].forEach(function (id) { $(id).addEventListener('input', render); });
  document.querySelectorAll('[data-type]').forEach(function (b) { b.addEventListener('click', function () { type = b.dataset.type; render(); }); });
  document.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { greek = b.dataset.g; render(); }); });
  $('ex-hull').addEventListener('click', function () { type = 'call'; load({ S: 42, K: 40, T: 0.5, r: 10, v: 20, q: 0, n: 100 }); });
  $('ex-amput').addEventListener('click', function () { type = 'put'; load({ S: 50, K: 50, T: 0.4167, r: 10, v: 40, q: 0, n: 5 }); });
  checks();
  render();
})();
