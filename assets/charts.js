/* Small dependency-free SVG charts for the tools on this site.
 *
 *   Charts.line(el, cfg)  line chart with numeric x, crosshair tooltip, direct labels,
 *                         legend and an optional table view
 *   Charts.bars(el, cfg)  vertical bars, including floating bars for waterfalls
 *
 * Both return { update(cfg) }. Colours come from CSS variables in /assets/charts.css
 * (--c1, --c2, --c3); text always uses the page's ink and muted colours.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = { 1: 'var(--c1)', 2: 'var(--c2)', 3: 'var(--c3)', muted: 'var(--muted)', ink: 'var(--ink)' };
  var measureCtx = null;

  function color(c) { return COLORS[c] || c || COLORS[1]; }
  function s(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function textWidth(t) {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    measureCtx.font = '600 12px "Public Sans", sans-serif';
    return measureCtx.measureText(String(t)).width;
  }
  function niceStep(range, count) {
    var raw = range / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function ticks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var step = niceStep(max - min, count);
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
    return { lo: lo, hi: hi, list: out, step: step };
  }
  function fmtDefault(v) {
    var a = Math.abs(v);
    return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function legend(el, items) {
    var old = el.querySelector(':scope > .chart-legend');
    if (old) old.remove();
    if (!items.length) return;
    var ul = h('ul', 'chart-legend', null);
    items.forEach(function (it) {
      var li = h('li', null, ul);
      var sw = h('i', it.square ? 'sq' : (it.dash ? 'dash' : ''), li);
      sw.style.color = color(it.color);
      h('span', null, li, it.name);
    });
    var after = el.querySelector(':scope > .chart-svg');
    after.insertAdjacentElement('afterend', ul);
  }

  function tableView(el, cfg) {
    var old = el.querySelector(':scope > .chart-table');
    if (old) old.remove();
    if (!cfg.table) return;
    var d = h('details', 'chart-table', el);
    h('summary', null, d, cfg.table.summary || 'Show the numbers as a table');
    var wrap = h('div', 'table-wrap', d);
    var t = h('table', 'data-table', wrap);
    var tr = h('tr', null, h('thead', null, t));
    cfg.table.head.forEach(function (c) { h('th', null, tr, c); });
    var tb = h('tbody', null, t);
    cfg.table.rows.forEach(function (row) {
      var r = h('tr', null, tb);
      row.forEach(function (c) { h('td', null, r, c); });
    });
  }

  function makeTip(el) {
    var tip = el.querySelector(':scope > .chart-tip');
    if (!tip) { tip = h('div', 'chart-tip', el); tip.setAttribute('aria-hidden', 'true'); }
    return tip;
  }
  function fillTip(tip, head, rows) {
    tip.textContent = '';
    h('div', 't-head', tip, head);
    rows.forEach(function (r) {
      var row = h('div', 't-row', tip);
      var i = h('i', null, row); i.style.color = color(r.color);
      if (r.color == null) i.style.visibility = 'hidden';
      h('span', 't-name', row, r.name);
      h('span', null, row, r.value);
    });
  }
  function placeTip(el, tip, px, top) {
    var w = tip.offsetWidth, W = el.clientWidth;
    var left = px + 14;
    if (left + w > W) left = px - w - 14;
    if (left < 0) left = Math.max(0, Math.min(W - w, px - w / 2));
    tip.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    tip.classList.add('on');
  }

  /* ---------------------------------------------------------------- line */
  function line(el, cfg) {
    el.classList.add('chart-wrap');
    var svg = s('svg', { class: 'chart-svg', role: 'img', tabindex: '0' });
    el.insertBefore(svg, el.firstChild);
    var tip = makeTip(el);
    var state = { cfg: cfg, idx: null };
    var geo = null;

    function render() {
      var c = state.cfg;
      var W = Math.max(280, el.clientWidth);
      var H = c.height || (W < 520 ? 250 : 300);
      var xs = c.x;
      var series = c.series.filter(function (sr) { return !sr.hidden; });
      var fmtY = c.yFormat || fmtDefault;
      var fmtX = c.xFormat || fmtDefault;
      var tipX = c.xTip || fmtX;
      svg.setAttribute('aria-label', c.label || '');
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      // y range
      var vals = [];
      series.forEach(function (sr) { sr.y.forEach(function (v) { if (isNum(v)) vals.push(v); }); });
      (c.bands || []).forEach(function (b) { b.lo.concat(b.hi).forEach(function (v) { if (isNum(v)) vals.push(v); }); });
      (c.hrefs || []).forEach(function (r) { vals.push(r.y); });
      (c.dots || []).forEach(function (d) { vals.push(d.y); });
      var ymin = c.yMin != null ? c.yMin : Math.min.apply(null, vals);
      var ymax = c.yMax != null ? c.yMax : Math.max.apply(null, vals);
      if (c.includeZero) { ymin = Math.min(0, ymin); ymax = Math.max(0, ymax); }
      var yt = ticks(ymin, ymax, H < 260 ? 4 : 5);
      if (c.yMin != null) yt.lo = c.yMin;
      if (c.yMax != null) yt.hi = c.yMax;
      var ylist = yt.list.filter(function (v) { return v >= yt.lo - 1e-9 && v <= yt.hi + 1e-9; });

      // padding
      var padL = 8 + Math.max.apply(null, ylist.map(function (v) { return textWidth(fmtY(v)); }));
      var labelW = 0;
      if (c.labels !== false) series.forEach(function (sr) { if (sr.label !== false) labelW = Math.max(labelW, textWidth(sr.label || sr.name)); });
      var padR = c.labels !== false && labelW ? Math.min(labelW + 12, W * 0.32) : 10;
      var padT = 10, padB = 26;
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      if (c.xMin != null) x0 = c.xMin;
      if (c.xMax != null) x1 = c.xMax;
      var iw = W - padL - padR, ih = H - padT - padB;
      function X(v) { return padL + (x1 === x0 ? iw / 2 : (v - x0) / (x1 - x0) * iw); }
      function Y(v) { return padT + (1 - (v - yt.lo) / (yt.hi - yt.lo)) * ih; }
      geo = { X: X, Y: Y, padL: padL, padT: padT, iw: iw, ih: ih, W: W, H: H, x0: x0, x1: x1 };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      // grid and y labels
      ylist.forEach(function (v) {
        s('line', { class: Math.abs(v) < 1e-9 ? 'ch-zero' : 'ch-grid', x1: padL, x2: padL + iw, y1: Y(v), y2: Y(v) }, svg);
        var t = s('text', { x: padL - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg);
        t.textContent = fmtY(v);
      });
      // x ticks
      var xticks = c.xTicks || ticks(x0, x1, W < 520 ? 4 : 7).list.filter(function (v) { return v >= x0 && v <= x1; });
      // thin out labels that would collide
      var tw = Math.max.apply(null, xticks.map(function (v) { return textWidth(fmtX(v)); })) + 10;
      var every = 1;
      while (xticks.length / every > 1 && iw / Math.ceil(xticks.length / every) < tw) every++;
      xticks = xticks.filter(function (v, i) { return i % every === 0; });
      xticks.forEach(function (v) {
        var t = s('text', { x: X(v), y: H - 6, 'text-anchor': 'middle' }, svg);
        t.textContent = fmtX(v);
      });
      // bands
      (c.bands || []).forEach(function (b) {
        var top = [], bot = [];
        xs.forEach(function (xv, i) { if (isNum(b.lo[i]) && isNum(b.hi[i])) { top.push(X(xv) + ',' + Y(b.hi[i])); bot.unshift(X(xv) + ',' + Y(b.lo[i])); } });
        if (top.length) s('polygon', { class: 'ch-band', points: top.concat(bot).join(' '), fill: color(b.color) }, svg);
      });
      // reference lines
      (c.refs || []).forEach(function (r) {
        s('line', { class: 'ch-ref', x1: X(r.x), x2: X(r.x), y1: padT, y2: padT + ih }, svg);
        if (r.label) { var t = s('text', { x: X(r.x) + 4, y: padT + 11 }, svg); t.textContent = r.label; }
      });
      (c.hrefs || []).forEach(function (r) {
        s('line', { class: 'ch-ref', x1: padL, x2: padL + iw, y1: Y(r.y), y2: Y(r.y) }, svg);
        if (r.label) {
          var t = s('text', { x: r.atX != null ? X(r.atX) : r.align === 'end' ? padL + iw - 4 : padL + 4, y: Y(r.y) + (r.below ? 14 : -5), 'text-anchor': r.align === 'end' ? 'end' : 'start' }, svg);
          t.textContent = r.label;
        }
      });
      // series
      var ends = [];
      series.forEach(function (sr) {
        var d = '', pen = false, last = null;
        xs.forEach(function (xv, i) {
          var v = sr.y[i];
          if (!isNum(v)) { pen = false; return; }
          if (!pen) { d += 'M' + X(xv).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; }
          else if (sr.step) d += 'H' + X(xv).toFixed(1) + 'V' + Y(v).toFixed(1);
          else d += 'L' + X(xv).toFixed(1) + ' ' + Y(v).toFixed(1);
          last = i;
        });
        s('path', { class: 'ch-line' + (sr.dash ? ' ch-dash' : ''), d: d, stroke: color(sr.color), 'stroke-width': sr.width || null }, svg);
        if (last != null && c.labels !== false && sr.label !== false) ends.push({ y: Y(sr.y[last]), x: X(xs[last]), text: sr.label || sr.name });
      });
      // direct labels, nudged apart
      ends.sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
      ends.forEach(function (e) {
        var t = s('text', { class: 'ch-label', x: e.x + 6, y: Math.min(e.y + 4, padT + ih + 4) }, svg);
        t.textContent = e.text;
      });
      // highlighted dots
      (c.dots || []).forEach(function (d) {
        s('circle', { class: 'ch-dot', cx: X(d.x), cy: Y(d.y), r: 5, fill: color(d.color) }, svg);
        if (d.label) {
          var t = s('text', { class: 'ch-label', x: X(d.x) + (d.anchor === 'end' ? -9 : 9), y: Y(d.y) + (d.dy || -8), 'text-anchor': d.anchor || 'start' }, svg);
          t.textContent = d.label;
        }
      });
      // hover layer
      geo.cross = s('line', { class: 'ch-cross', y1: padT, y2: padT + ih, visibility: 'hidden' }, svg);
      geo.marks = series.map(function (sr) { return s('circle', { class: 'ch-dot', r: 4.5, fill: color(sr.color), visibility: 'hidden' }, svg); });
      geo.series = series;
      s('rect', { class: 'ch-hit', x: padL, y: 0, width: iw, height: H }, svg);
      geo.fmtY = c.tipFormat || fmtY; geo.tipX = tipX;

      legend(el, c.legend === false ? [] : (series.length > 1 || c.legend ? series.filter(function (sr) { return sr.legend !== false; }).map(function (sr) { return { name: sr.name, color: sr.color, dash: sr.dash }; }) : []));
      tableView(el, c);
      if (state.idx != null) show(state.idx);
    }

    function nearest(px) {
      var xs = state.cfg.x, best = 0, bd = Infinity;
      for (var i = 0; i < xs.length; i++) {
        var d = Math.abs(geo.X(xs[i]) - px);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    function show(i) {
      var c = state.cfg, xs = c.x;
      if (i == null || i < 0 || i >= xs.length) return hide();
      state.idx = i;
      var px = geo.X(xs[i]);
      geo.cross.setAttribute('x1', px); geo.cross.setAttribute('x2', px); geo.cross.setAttribute('visibility', 'visible');
      var rows = [];
      geo.series.forEach(function (sr, k) {
        var v = sr.y[i], m = geo.marks[k];
        if (isNum(v)) { m.setAttribute('cx', px); m.setAttribute('cy', geo.Y(v)); m.setAttribute('visibility', 'visible'); }
        else m.setAttribute('visibility', 'hidden');
        if (sr.tip !== false) rows.push({ name: sr.name, value: isNum(v) ? geo.fmtY(v) : 'n/a', color: sr.color });
      });
      if (c.tipExtra) c.tipExtra(i).forEach(function (r) { rows.push(r); });
      fillTip(tip, geo.tipX(xs[i], i), rows);
      var scale = el.clientWidth / geo.W;
      placeTip(el, tip, px * scale, geo.padT * scale);
    }
    function hide() {
      state.idx = null;
      tip.classList.remove('on');
      if (!geo) return;
      geo.cross.setAttribute('visibility', 'hidden');
      geo.marks.forEach(function (m) { m.setAttribute('visibility', 'hidden'); });
    }
    function toLocal(ev) {
      var r = svg.getBoundingClientRect();
      return (ev.clientX - r.left) * (geo.W / r.width);
    }
    svg.addEventListener('pointermove', function (ev) { show(nearest(toLocal(ev))); });
    svg.addEventListener('pointerdown', function (ev) { show(nearest(toLocal(ev))); });
    svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (ev) {
      var n = state.cfg.x.length;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        var i = state.idx == null ? n - 1 : state.idx + (ev.key === 'ArrowRight' ? 1 : -1);
        show(Math.max(0, Math.min(n - 1, i)));
      } else if (ev.key === 'Escape') hide();
    });
    document.addEventListener('pointerdown', function (ev) { if (!el.contains(ev.target)) hide(); });

    render();
    if ('ResizeObserver' in window) {
      var lastW = el.clientWidth;
      new ResizeObserver(function () { if (el.clientWidth !== lastW) { lastW = el.clientWidth; render(); } }).observe(el);
    }
    return { update: function (cfg2) { state.cfg = cfg2; render(); } };
  }

  /* ---------------------------------------------------------------- bars */
  // cfg.bars: [{ label, value, base (optional, for floating bars), color, note }]
  function bars(el, cfg) {
    el.classList.add('chart-wrap');
    var svg = s('svg', { class: 'chart-svg', role: 'img', tabindex: '0' });
    el.insertBefore(svg, el.firstChild);
    var tip = makeTip(el);
    var state = { cfg: cfg }, geo = null;

    function render() {
      var c = state.cfg, B = c.bars;
      var W = Math.max(280, el.clientWidth);
      var H = c.height || (W < 520 ? 250 : 290);
      var fmt = c.format || fmtDefault;
      svg.setAttribute('aria-label', c.label || '');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var lo = 0, hi = 0;
      B.forEach(function (b) { var a = b.base || 0, e = a + b.value; lo = Math.min(lo, a, e); hi = Math.max(hi, a, e); });
      var yt = ticks(lo, hi, 4);
      var padL = 8 + Math.max.apply(null, yt.list.map(function (v) { return textWidth(fmt(v)); }));
      var padR = 6, padT = 22, padB = 34;
      var iw = W - padL - padR, ih = H - padT - padB;
      function Y(v) { return padT + (1 - (v - yt.lo) / (yt.hi - yt.lo)) * ih; }
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      yt.list.forEach(function (v) {
        s('line', { class: Math.abs(v) < 1e-9 ? 'ch-zero' : 'ch-grid', x1: padL, x2: padL + iw, y1: Y(v), y2: Y(v) }, svg);
        var t = s('text', { x: padL - 8, y: Y(v) + 4, 'text-anchor': 'end' }, svg); t.textContent = fmt(v);
      });
      var slot = iw / B.length, bw = Math.min(56, slot * 0.62);
      var small = slot < 64;
      geo = { slot: slot, padL: padL, W: W, rects: [] };
      B.forEach(function (b, i) {
        var a = b.base || 0, e = a + b.value;
        var top = Y(Math.max(a, e)), bot = Y(Math.min(a, e));
        var cx = padL + slot * (i + 0.5);
        var hgt = Math.max(1, bot - top);
        var r = Math.min(4, hgt / 2, bw / 2);
        // rounded at the end away from the base
        var up = e >= a, x = cx - bw / 2;
        var d = up
          ? 'M' + x + ' ' + bot + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + top + ' ' + (x + bw) + ' ' + (top + r) + 'V' + bot + 'Z'
          : 'M' + x + ' ' + top + 'V' + (bot - r) + 'Q' + x + ' ' + bot + ' ' + (x + r) + ' ' + bot + 'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + bot + ' ' + (x + bw) + ' ' + (bot - r) + 'V' + top + 'Z';
        geo.rects.push(s('path', { class: 'ch-bar', d: d, fill: color(b.color) }, svg));
        // value labels only where there is room for them; the tooltip and the table always have the numbers
        if (slot >= 38 && c.values !== false) {
          var vt = s('text', { class: 'ch-label', x: cx, y: up || b.base ? (up ? top - 6 : bot + 14) : top - 6, 'text-anchor': 'middle' }, svg);
          vt.textContent = (b.showSign && b.value > 0 ? '+' : '') + fmt(b.value);
        }
        if (i < B.length - 1 && c.connect) {
          s('line', { class: 'ch-ref', x1: cx + bw / 2, x2: padL + slot * (i + 1.5) - bw / 2, y1: Y(e), y2: Y(e) }, svg);
        }
        var words = String(b.label).split(' ');
        var lines = small && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [b.label];
        lines.forEach(function (ln, k) {
          var lt = s('text', { x: cx, y: H - padB + 16 + k * 13, 'text-anchor': 'middle' }, svg); lt.textContent = ln;
        });
      });
      s('rect', { class: 'ch-hit', x: padL, y: 0, width: iw, height: H }, svg);
      if (c.legend) legend(el, c.legend); else legend(el, []);
      tableView(el, c);
    }
    function idxAt(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) * (geo.W / r.width);
      return Math.floor((px - geo.padL) / geo.slot);
    }
    function show(i) {
      var B = state.cfg.bars;
      if (i < 0 || i >= B.length) return hide();
      var b = B[i], fmt = state.cfg.format || fmtDefault;
      var rows = [{ name: 'Value', value: (b.showSign && b.value > 0 ? '+' : '') + fmt(b.value), color: b.color }];
      if (b.note) rows.push({ name: b.note, value: '', color: null });
      fillTip(tip, b.label, rows);
      geo.rects.forEach(function (rc, k) { rc.style.opacity = k === i ? 1 : 0.55; });
      var scale = el.clientWidth / geo.W;
      placeTip(el, tip, (geo.padL + geo.slot * (i + 0.5)) * scale, 0);
    }
    function hide() { tip.classList.remove('on'); if (geo) geo.rects.forEach(function (rc) { rc.style.opacity = ''; }); }
    svg.addEventListener('pointermove', function (ev) { show(idxAt(ev)); });
    svg.addEventListener('pointerdown', function (ev) { show(idxAt(ev)); });
    svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
    document.addEventListener('pointerdown', function (ev) { if (!el.contains(ev.target)) hide(); });
    render();
    if ('ResizeObserver' in window) {
      var lastW = el.clientWidth;
      new ResizeObserver(function () { if (el.clientWidth !== lastW) { lastW = el.clientWidth; render(); } }).observe(el);
    }
    return { update: function (cfg2) { state.cfg = cfg2; render(); } };
  }

  window.Charts = { line: line, bars: bars, ticks: ticks };
})();
