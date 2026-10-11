/* Case interview trainer: case picker, timer, four steps, answer checking,
 * self-assessment saved in this browser, and a mental maths drill.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CASES = window.CASES || [];
  var STORE = 'case-trainer-v1';
  var cur = null, step = 0, charts = [];
  var timer = { start: null, acc: 0, id: null };

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) { /* storage unavailable */ } }
  function el(tag, cls, text, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmtTime(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function fmtNum(v) {
    var a = Math.abs(v);
    var d = a >= 1000 ? 0 : a >= 100 ? 1 : 2;
    var r = +v.toFixed(d);
    return r.toLocaleString('en-GB', { maximumFractionDigits: d }).replace(/,/g, ' ').replace('-', '−');
  }
  function parseNum(s) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/\s/g, '').replace('−', '-').replace(/%$/, '');
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    var m = s.match(/^(-?\d*\.?\d+)(k|m|mn|bn)?$/i);
    if (!m) return NaN;
    var v = parseFloat(m[1]), u = (m[2] || '').toLowerCase();
    return v * (u === 'k' ? 1e3 : u === 'm' || u === 'mn' ? 1e6 : u === 'bn' ? 1e9 : 1);
  }
  function close(v, q) {
    if (!isFinite(v)) return false;
    if (q.rel) return Math.abs(v - q.answer) <= Math.abs(q.answer) * q.tol;
    return Math.abs(v - q.answer) <= q.tol + 1e-9;
  }

  /* ---------- picker ---------- */
  function list() {
    var ul = $('case-list'), done = load();
    ul.textContent = '';
    CASES.forEach(function (c) {
      var li = el('li', null, null, ul);
      var b = el('button', 'case-pick', null, li);
      b.type = 'button';
      b.setAttribute('aria-current', String(!!cur && cur.id === c.id));
      el('span', 'case-name', c.title, b);
      var meta = el('span', 'case-meta', c.type + ' · ' + c.minutes + ' min · ' + c.level, b);
      var att = (done[c.id] || []).length;
      if (att) { meta.appendChild(document.createTextNode(' · ')); el('span', 'case-done', att === 1 ? 'Done once' : 'Done ' + att + ' times', meta); }
      el('span', 'case-arrow', '→', b).setAttribute('aria-hidden', 'true');
      b.addEventListener('click', function () { open(c.id, true); });
    });
  }

  /* ---------- timer ---------- */
  function elapsed() { return timer.acc + (timer.start ? Date.now() - timer.start : 0); }
  function tick() {
    var e = elapsed(), target = cur.minutes * 60000;
    $('t-time').textContent = fmtTime(e);
    $('t-target').textContent = e > target ? 'Over by ' + fmtTime(e - target) : 'of ' + cur.minutes + ':00';
  }
  function startStop() {
    if (timer.start) { timer.acc += Date.now() - timer.start; timer.start = null; clearInterval(timer.id); $('t-toggle').textContent = 'Resume'; }
    else { timer.start = Date.now(); timer.id = setInterval(tick, 250); $('t-toggle').textContent = 'Pause'; }
    tick();
  }
  function resetTimer() { clearInterval(timer.id); timer = { start: null, acc: 0, id: null }; $('t-toggle').textContent = 'Start'; if (cur) tick(); }

  /* ---------- case ---------- */
  function go(n) {
    step = n;
    document.querySelectorAll('.case-step').forEach(function (s) { s.hidden = +s.dataset.step !== n; });
    document.querySelectorAll('#steps button').forEach(function (b) {
      if (+b.dataset.step === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    if (n === 2) charts.forEach(function (fn) { fn(); });
  }

  function tree(node, parent) {
    var li = el('li', null, null, parent);
    el('span', 'node', node.label, li);
    if (node.children && node.children.length) {
      var ul = el('ul', null, null, li);
      node.children.forEach(function (c) { tree(c, ul); });
    }
  }

  function exhibits(c) {
    var box = $('c-exhibits'); box.textContent = ''; charts = [];
    c.exhibits.forEach(function (x) {
      var d = el('div', 'exhibit', null, box);
      el('h3', null, x.title, d);
      if (x.kind === 'table') {
        var w = el('div', 'table-wrap', null, d), t = el('table', 'data-table', null, w);
        var tr = el('tr', null, null, el('thead', null, null, t));
        x.head.forEach(function (h) { el('th', null, h, tr); });
        var tb = el('tbody', null, null, t);
        x.rows.forEach(function (r, i) {
          var row = el('tr', /^(Total|Operating profit)/.test(r[0]) ? 'hl' : null, null, tb);
          r.forEach(function (v) { el('td', null, v, row); });
        });
      } else if (x.kind === 'bars') {
        var holder = el('div', null, null, d);
        var made = false;
        charts.push(function () {
          if (made) return; made = true;
          Charts.bars(holder, {
            label: x.title, height: 220,
            bars: x.bars.map(function (b) { return { label: b.label, value: b.value, color: b.value < 0 ? 2 : 1 }; }),
            format: function (v) { return v.toFixed(x.format).replace('-', '−'); }
          });
        });
      }
      if (x.note) el('p', 'note', x.note, d);
    });
  }

  function questions(c) {
    var box = $('c-questions'); box.textContent = '';
    c.questions.forEach(function (q, i) {
      var d = el('div', 'q', null, box);
      el('p', null, (i + 1) + '. ' + q.q, d);
      var row = el('div', 'q-row', null, d);
      var inp = el('input', 'field', null, row);
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.enterKeyHint = 'done'; inp.autocomplete = 'off';
      inp.setAttribute('aria-label', 'Your answer to question ' + (i + 1));
      el('span', 'q-unit', q.unit, row);
      var chk = el('button', 'btn', 'Check', row); chk.type = 'button';
      var sol = el('button', 'btn btn-quiet', 'Show solution', row); sol.type = 'button';
      var res = el('p', 'q-result', null, d); res.setAttribute('aria-live', 'polite');
      var sbox = el('div', 'q-solution', q.solution, d); sbox.hidden = true;
      function check() {
        var v = parseNum(inp.value);
        res.textContent = '';
        if (!isFinite(v)) { res.textContent = 'Type a number, for example 4.9, 180000 or 180k.'; return; }
        var ok = close(v, q);
        var s = el('strong', null, ok ? 'Correct. ' : 'Not quite. ', res);
        res.appendChild(document.createTextNode(ok ? 'The answer is ' + fmtNum(q.answer) + ' ' + q.unit + '.' : 'Check your working, or open the solution.'));
        if (ok) sbox.hidden = false;
      }
      chk.addEventListener('click', check);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      sol.addEventListener('click', function () { sbox.hidden = !sbox.hidden; sol.textContent = sbox.hidden ? 'Show solution' : 'Hide solution'; });
    });
  }

  var CHECKS = ['I restated the question and the objective', 'My structure had 3 to 5 parts that did not overlap', 'I started with a hypothesis', 'I got the numbers right', 'I said what each number means for the client', 'My recommendation started with the answer'];

  function open(id, scroll) {
    var c = CASES.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    cur = c;
    var sec = $('case'); sec.hidden = false;
    $('case-h').textContent = c.title;
    $('c-brief').textContent = c.brief;
    var cl = $('c-clarify'); cl.textContent = '';
    c.clarify.forEach(function (x) { var d = el('details', null, null, cl); el('summary', null, x.q, d); el('p', null, x.a, d); });
    var t = $('c-tree'); t.hidden = true; t.textContent = '';
    var ul = el('ul', 'tree', null, t); tree(c.structure, ul);
    $('c-show-tree').textContent = 'Show a model structure';
    exhibits(c); questions(c);
    var m = $('c-model'); m.hidden = true; m.textContent = '';
    var mm = el('div', 'model', null, m);
    c.recommendation.forEach(function (p) { el('p', null, p, mm); });
    el('h3', null, 'Common mistakes', m);
    var pu = el('ul', null, null, m); c.pitfalls.forEach(function (p) { el('li', null, p, pu); });
    $('c-show-model').textContent = 'Show the model answer';
    var ck = $('c-check'); ck.textContent = '';
    CHECKS.forEach(function (txt, i) {
      var li = el('li', null, null, ck), lab = el('label', null, null, li), inp = el('input', null, null, lab);
      inp.type = 'checkbox'; inp.id = 'ck' + i; lab.appendChild(document.createTextNode(txt));
    });
    var st = load();
    $('c-notes').value = (st.notes || {})[c.id] || '';
    $('c-rec').value = (st.recs || {})[c.id] || '';
    $('c-saved').textContent = '';
    showHistory();
    resetTimer(); go(0); list();
    try { history.replaceState(null, '', '#' + c.id); } catch (e) { /* ignore */ }
    if (scroll) sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function showHistory() {
    var h = $('c-history'); h.textContent = '';
    var att = (load()[cur.id] || []).slice(-5).reverse();
    if (!att.length) return;
    el('p', null, 'Your last attempts:', h);
    var ul = el('ul', null, null, h);
    att.forEach(function (a) { el('li', null, a.date + ': ' + a.score + ' of ' + CHECKS.length + ' points, ' + a.time, ul); });
  }

  function persist(key, val) {
    var st = load(); st[key] = st[key] || {}; st[key][cur.id] = val; save(st);
  }

  /* ---------- maths drill ---------- */
  var drill = { start: 0, qs: [], right: 0, answered: 0 };
  function rnd(a, b, step) { step = step || 1; return a + step * Math.floor(Math.random() * ((b - a) / step + 1)); }
  var GEN = [
    function () { var p = rnd(5, 45, 5), n = rnd(12, 96, 4) * 100000; return { q: p + '% of ' + fmtNum(n), a: n * p / 100 }; },
    function () { var a = rnd(12, 95), b = rnd(12, 95) * 10; return { q: a + ' × ' + b, a: a * b }; },
    function () { var a = rnd(40, 400, 10), g = rnd(-30, 60, 5); var b = a * (1 + g / 100); return { q: 'Growth from ' + fmtNum(a) + ' to ' + fmtNum(b) + ', in %', a: g, abs: 0.5 }; },
    function () { var f = rnd(2, 20) * 1e6, p = rnd(80, 300, 10), v = Math.round(p * rnd(30, 70, 5) / 100); return { q: 'Break-even units: fixed costs ' + fmtNum(f / 1e6) + ' million, price ' + p + ', variable cost ' + v, a: f / (p - v) }; },
    function () { var a = rnd(15, 90) * 1e6, b = rnd(3, 25) * 1e3; return { q: fmtNum(a / 1e6) + ' million ÷ ' + fmtNum(b), a: a / b }; },
    function () { var m = rnd(5, 30), r = rnd(2, 40) * 10; return { q: 'Margin ' + m + '% on revenue of ' + r + ' million: profit in million', a: r * m / 100 }; },
    function () { var r = rnd(2, 12); return { q: 'Years to double at ' + r + '% a year (rule of 72)', a: 72 / r, abs: 0.6 }; },
    function () { var c = rnd(20, 80) * 1e3, s = rnd(5, 30); return { q: 'A market of ' + fmtNum(c) + ' customers, ' + s + '% share, NOK 1,200 each: revenue in NOK million', a: c * s / 100 * 1200 / 1e6 }; }
  ];
  function newDrill() {
    var box = $('d-list'); box.textContent = '';
    drill = { start: Date.now(), qs: [], right: 0, answered: 0 };
    $('d-score').textContent = '0 / 10';
    $('d-time').textContent = 'Timer started.';
    var order = GEN.slice().sort(function () { return Math.random() - 0.5; });
    for (var i = 0; i < 10; i++) {
      var q = order[i % order.length]();
      drill.qs.push(q);
      (function (q, i) {
        var d = el('div', 'drill-q', null, box);
        el('span', 'n', (i + 1) + '.', d);
        el('span', null, q.q, d);
        var row = el('div', 'q-row', null, d);
        var inp = el('input', 'field', null, row); inp.type = 'text'; inp.inputMode = 'decimal'; inp.enterKeyHint = 'next'; inp.autocomplete = 'off';
        inp.setAttribute('aria-label', 'Answer to ' + q.q);
        var b = el('button', 'btn', 'Check', row); b.type = 'button';
        var res = el('p', 'q-result', null, d); res.setAttribute('aria-live', 'polite');
        var done = false;
        function check() {
          var v = parseNum(inp.value);
          if (!isFinite(v)) { res.textContent = 'Type a number.'; return; }
          var ok = q.abs != null ? Math.abs(v - q.a) <= q.abs : Math.abs(v - q.a) <= Math.abs(q.a) * 0.02;
          res.textContent = (ok ? 'Correct: ' : 'Answer: ') + fmtNum(q.a);
          if (!done) { done = true; drill.answered++; if (ok) drill.right++; }
          $('d-score').textContent = drill.right + ' / 10';
          if (drill.answered === 10) {
            var t = fmtTime(Date.now() - drill.start);
            $('d-time').textContent = 'Done in ' + t + '. ' + (drill.right >= 9 ? 'Interview ready.' : drill.right >= 7 ? 'Good. Speed comes with practice.' : 'Try another round, and round the numbers before you calculate.');
          }
          var next = d.nextElementSibling && d.nextElementSibling.querySelector('input');
          if (next && ok) next.focus();
        }
        b.addEventListener('click', check);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      })(q, i);
    }
  }

  /* ---------- wiring ---------- */
  document.querySelectorAll('#steps button').forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.step); }); });
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { go(+b.dataset.go); $('case').scrollIntoView({ block: 'start' }); });
  });
  $('t-toggle').addEventListener('click', startStop);
  $('t-reset').addEventListener('click', resetTimer);
  $('c-show-tree').addEventListener('click', function () { var t = $('c-tree'); t.hidden = !t.hidden; this.textContent = t.hidden ? 'Show a model structure' : 'Hide the model structure'; });
  $('c-show-model').addEventListener('click', function () { var t = $('c-model'); t.hidden = !t.hidden; this.textContent = t.hidden ? 'Show the model answer' : 'Hide the model answer'; });
  $('c-notes').addEventListener('input', function () { persist('notes', this.value); });
  $('c-rec').addEventListener('input', function () { persist('recs', this.value); });
  $('c-save').addEventListener('click', function () {
    var score = document.querySelectorAll('#c-check input:checked').length;
    var st = load(); st[cur.id] = st[cur.id] || [];
    var d = new Date();
    st[cur.id].push({ date: d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(), score: score, time: fmtTime(elapsed()) });
    save(st);
    $('c-saved').textContent = 'Saved: ' + score + ' of ' + CHECKS.length + ' points in ' + fmtTime(elapsed()) + '.';
    showHistory(); list();
  });
  $('d-new').addEventListener('click', newDrill);

  list();
  newDrill();
  var hash = location.hash.slice(1);
  if (hash && CASES.some(function (c) { return c.id === hash; })) open(hash, false);
})();
