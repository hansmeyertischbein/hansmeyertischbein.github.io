/* Small helpers shared by the games: storage that never throws, time format, swipe detection. */
window.Games = (function () {
  'use strict';
  function load(key, fallback) { try { const v = localStorage.getItem('games:' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem('games:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } }
  function time(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  // calls cb('up'|'down'|'left'|'right') on a swipe of at least 24 px
  function swipe(el, cb) {
    let x0 = null, y0 = null, id = null;
    el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY; id = e.pointerId; }, { passive: true });
    el.addEventListener('pointerup', e => {
      if (x0 === null || e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    el.addEventListener('pointercancel', () => { x0 = null; });
  }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { load, save, time, swipe, reduced };
})();
