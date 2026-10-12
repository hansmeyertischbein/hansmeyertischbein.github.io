/* Spin the wheel: shared state, drawing and the fair spin used by all three steps.
 * The wheel is honest: each slice is as wide as its probability, the winner is drawn
 * with crypto-grade randomness by those probabilities, and the pointer stops at a
 * random point inside the winning slice.
 */
window.Wheel = (function () {
  'use strict';
  const KEY = 'wheel';
  const EXAMPLE = {
    title: 'Prize wheel',
    items: [
      { name: 'Free coffee', weight: 40 },
      { name: 'Tote bag', weight: 25 },
      { name: 'Cinema ticket', weight: 20 },
      { name: 'Concert ticket', weight: 10 },
      { name: 'Grand prize', weight: 5 }
    ],
    picks: 1,
    repeat: false
  };
  // Twelve slice colours in a fixed order; every slice is also numbered and named, so colour is never the only cue
  const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#8a5cd0', '#d4a20a', '#d6457a', '#2aa3b8', '#6f8a1f', '#b8572a', '#4b5fc0', '#c03c3c', '#3d8f63'];

  function clean(s) {
    const st = s && Array.isArray(s.items) ? s : JSON.parse(JSON.stringify(EXAMPLE));
    st.title = String(st.title ?? '').slice(0, 80);
    st.items = st.items.map(it => ({ name: String(it.name ?? '').slice(0, 60), weight: Number.isFinite(+it.weight) && +it.weight >= 0 ? +it.weight : 0 }));
    st.picks = Math.max(1, Math.min(100, Math.round(+st.picks || 1)));
    st.repeat = !!st.repeat;
    return st;
  }
  function load() {
    // a shared link carries the wheel in the address; otherwise use this browser's copy
    try {
      const m = location.hash.match(/^#w=(.+)$/);
      if (m) return clean(JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))));
    } catch (e) { /* ignore a broken link */ }
    try { const v = localStorage.getItem(KEY); if (v) return clean(JSON.parse(v)); } catch (e) { /* storage unavailable */ }
    return clean(null);
  }
  let memory = null;
  function save(st) {
    memory = st;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage unavailable: links carry the state */ }
  }
  function encode(st) { return btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  // links between the steps carry the state too, in case storage is blocked
  function linkTo(path, st) { return path + '#w=' + encode(st); }

  function valid(st) { return st.items.filter(i => i.name.trim()).length >= 2; }
  function usable(st) { return st.items.filter(i => i.name.trim()); }
  // probabilities in [0,1], scaled to sum to one
  function probs(st) {
    const it = usable(st), sum = it.reduce((a, b) => a + b.weight, 0);
    return it.map(i => ({ name: i.name.trim(), p: sum > 0 ? i.weight / sum : 1 / it.length }));
  }
  const pct1 = p => (Math.round(p * 1000) / 10).toFixed(1).replace(/\.0$/, '.0') + '%';

  function rnd() {
    if (window.crypto && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
    return Math.random();
  }
  function pick(ps) {
    const total = ps.reduce((a, b) => a + b.p, 0);
    let r = rnd() * total;
    for (let i = 0; i < ps.length; i++) { r -= ps[i].p; if (r < 0) return i; }
    return ps.length - 1;
  }

  /* ---------- drawing ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, a, parent) { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (parent) parent.appendChild(n); return n; }
  function arc(cx, cy, r, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.sin(a0), y0 = cy - r * Math.cos(a0), x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
    return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`;
  }
  // draws the wheel into an <svg>; returns the rotating group and slice angles (radians, clockwise from the top)
  function draw(svg, ps, opts = {}) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const R = 200, C = 210;
    svg.setAttribute('viewBox', '0 0 420 440');
    const g = s('g', { class: 'wheel-rot' }, svg);
    g.style.transformOrigin = `${C}px ${C + 10}px`;
    const inner = s('g', { transform: `translate(0 10)` }, g);
    let a = 0;
    const slices = ps.map((x, i) => {
      const a0 = a, a1 = a + x.p * Math.PI * 2; a = a1;
      return { i, a0, a1, color: COLORS[i % COLORS.length] };
    });
    slices.forEach(sl => {
      if (ps.length === 1 || sl.a1 - sl.a0 >= Math.PI * 2 - 1e-9) s('circle', { cx: C, cy: C, r: R, fill: sl.color }, inner);
      else s('path', { d: arc(C, C, R, sl.a0, sl.a1), fill: sl.color, stroke: 'var(--paper)', 'stroke-width': 2, 'stroke-linejoin': 'round' }, inner);
    });
    // labels along the radius, only where the slice is wide enough to read
    slices.forEach(sl => {
      const span = sl.a1 - sl.a0;
      if (span < 0.13) return;
      const mid = (sl.a0 + sl.a1) / 2, deg = mid * 180 / Math.PI;
      const t = s('text', { class: 'wheel-label', x: C, y: C - R + 18, transform: `rotate(${deg.toFixed(2)} ${C} ${C})`, 'text-anchor': 'middle' }, inner);
      t.textContent = String(sl.i + 1);
      if (span >= 0.3 && opts.names !== false) {
        const rr = R - 34, px = C + rr * Math.sin(mid), py = C - rr * Math.cos(mid);
        const left = deg > 180, rot = left ? deg + 90 : deg - 90;
        const nt = s('text', { class: 'wheel-name', x: px.toFixed(1), y: py.toFixed(1), transform: `rotate(${rot.toFixed(2)} ${px.toFixed(1)} ${py.toFixed(1)})`, 'text-anchor': left ? 'start' : 'end', 'dominant-baseline': 'middle' }, inner);
        const name = ps[sl.i].name, max = 18;
        nt.textContent = name.length > max ? name.slice(0, max - 1) + '…' : name;
      }
    });
    s('circle', { cx: C, cy: C, r: 22, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2 }, inner);
    // pointer at the top, outside the rotating group
    s('path', { d: `M${C - 14} 0 L${C + 14} 0 L${C} 34 Z`, fill: 'var(--ink)', stroke: 'var(--paper)', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
    return { g, slices };
  }

  /* ---------- spinning ---------- */
  // rotates the wheel so the pointer lands at a random point inside slice `idx`; resolves when it stops
  function spin(wheel, idx, current) {
    const sl = wheel.slices[idx];
    const margin = Math.min(0.15, (sl.a1 - sl.a0) * 0.15);
    const target = sl.a0 + margin + rnd() * (sl.a1 - sl.a0 - 2 * margin); // angle on the wheel that ends under the pointer
    const targetDeg = 360 - target * 180 / Math.PI;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const turns = reduced ? 1 : 5 + Math.floor(rnd() * 3);
    const base = Math.ceil(current / 360) * 360;
    const end = base + turns * 360 + targetDeg;
    const ms = reduced ? 400 : 4200;
    ticks(wheel, current, end, ms);
    wheel.g.style.transition = `transform ${ms}ms cubic-bezier(0.12, 0.8, 0.18, 1)`;
    wheel.g.style.transform = `rotate(${end}deg)`;
    return new Promise(res => setTimeout(() => res(end), ms + 50));
  }

  // a tick each time a slice edge passes the pointer, timed along the same easing curve as the animation
  function ticks(wheel, from, to, ms) {
    if (!window.GameAudio) return;
    const edges = wheel.slices.map(sl => sl.a0 * 180 / Math.PI);
    const bez = (u, p1, p2) => 3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u;
    let last = -1, prevR = from;
    for (let k = 1; k <= 1500; k++) {
      const u = k / 1500, time = bez(u, 0.12, 0.18) * ms / 1000, r = from + bez(u, 0.8, 1) * (to - from);
      for (const e of edges) {
        const n = Math.floor((r + e) / 360) - Math.floor((prevR + e) / 360);
        if (n > 0 && time - last > 0.035) { GameAudio.sfx('tick', null, time); last = time; }
      }
      prevR = r;
    }
  }

  /* ---------- step bar ---------- */
  function steps(active, st) {
    const nav = document.getElementById('steps');
    if (!nav) return;
    const paths = ['/games/wheel/', '/games/wheel/odds/', '/games/wheel/poster/'];
    nav.querySelectorAll('a').forEach((a, i) => {
      a.href = linkTo(paths[i], st);
      if (i === active) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      if (i > 0 && !valid(st)) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); }
      else a.removeAttribute('aria-disabled');
    });
    document.querySelectorAll('[data-go]').forEach(a => {
      const i = +a.dataset.go;
      if (i > 0 && !valid(st)) { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); }
      else { a.removeAttribute('aria-disabled'); a.href = linkTo(paths[i], st); }
    });
  }

  return { load, save, linkTo, valid, usable, probs, pct1, pick, draw, spin, steps, COLORS, EXAMPLE, encode };
})();
