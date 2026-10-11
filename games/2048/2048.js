/* 2048 with sliding and merging animations, one-step undo and a saved game. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const N = 4, layer = $('tiles');
  let tiles = [], score = 0, best = Games.load('2048-best', 0), nextId = 1, prev = null, won = false, keepGoing = false, busy = false;
  const els = new Map();

  document.querySelector('.g-cells').innerHTML = '<span></span>'.repeat(16);

  function style(el, t) {
    el.style.setProperty('--x', t.x); el.style.setProperty('--y', t.y);
    const lvl = Math.log2(t.v);
    el.className = 'tile';
    if (t.v > 2048) el.classList.add('big');
    else { el.style.setProperty('--p', Math.min(100, 6 + lvl * 8.5) + '%'); if (lvl >= 7) el.classList.add('light'); }
    const d = String(t.v).length; if (d >= 3) el.classList.add('d' + Math.min(d, 5));
    el.textContent = t.v;
  }
  function addEl(t, cls) {
    const el = document.createElement('div');
    style(el, t); if (cls) el.classList.add(cls);
    layer.append(el); els.set(t.id, el);
  }
  function renderAll() {
    layer.textContent = ''; els.clear();
    tiles.forEach(t => addEl(t));
    hud();
  }
  function hud() {
    $('score').textContent = score; $('best').textContent = best; $('undo').disabled = !prev;
    $('board').setAttribute('aria-label', '2048 board. ' + rowsText());
  }
  function rowsText() {
    const g = grid();
    return g.map(r => r.map(t => (t ? t.v : 'empty')).join(', ')).map((r, i) => `Row ${i + 1}: ${r}`).join('. ');
  }
  function grid() {
    const g = Array.from({ length: N }, () => new Array(N).fill(null));
    tiles.forEach(t => { g[t.y][t.x] = t; });
    return g;
  }
  function spawn() {
    const g = grid(), free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) free.push([x, y]);
    if (!free.length) return null;
    const [x, y] = free[Math.floor(Math.random() * free.length)];
    const t = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, x, y };
    tiles.push(t);
    return t;
  }
  function canMove() {
    const g = grid();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = g[y][x]; if (!t) return true;
      if (x < N - 1 && g[y][x + 1] && g[y][x + 1].v === t.v) return true;
      if (y < N - 1 && g[y + 1][x] && g[y + 1][x].v === t.v) return true;
    }
    return false;
  }
  function snapshot() { return { tiles: tiles.map(t => ({ ...t })), score, won, keepGoing }; }
  function persist() { Games.save('2048', { tiles, score, won, keepGoing, nextId }); }

  function move(dir) {
    if (busy || $('overlay').classList.contains('on')) return;
    const vec = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    const g = grid(), before = snapshot();
    const xs = [...Array(N).keys()], ys = [...Array(N).keys()];
    if (vec[0] === 1) xs.reverse(); if (vec[1] === 1) ys.reverse();
    let moved = false, gained = 0;
    const merges = [], mergedInto = new Set();
    const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : undefined);
    for (const y of ys) for (const x of xs) {
      const t = g[y][x]; if (!t) continue;
      let cx = x, cy = y;
      while (at(cx + vec[0], cy + vec[1]) === null) { cx += vec[0]; cy += vec[1]; }
      const next = at(cx + vec[0], cy + vec[1]);
      g[y][x] = null;
      if (next && next.v === t.v && !mergedInto.has(next.id)) {
        mergedInto.add(next.id); merges.push([t, next]);
        t.x = next.x; t.y = next.y; moved = true; gained += t.v * 2;
      } else {
        if (cx !== x || cy !== y) moved = true;
        t.x = cx; t.y = cy; g[cy][cx] = t;
      }
    }
    if (!moved) return;
    prev = before; busy = true;
    tiles.forEach(t => { const el = els.get(t.id); el.style.setProperty('--x', t.x); el.style.setProperty('--y', t.y); });
    const finish = () => {
      merges.forEach(([gone, keep]) => {
        els.get(gone.id).remove(); els.delete(gone.id);
        tiles = tiles.filter(t => t !== gone);
        keep.v *= 2;
        const el = els.get(keep.id); style(el, keep); void el.offsetWidth; el.classList.add('merged');
      });
      score += gained;
      if (score > best) { best = score; Games.save('2048-best', best); }
      const t = spawn(); if (t) addEl(t, 'new');
      busy = false; hud(); persist();
      if (!won && tiles.some(t => t.v >= 2048)) { won = true; persist(); show('You made 2048', `Score ${score}. Keep going for a bigger tile, or start again.`, true); }
      else if (!canMove()) show('Game over', `Score ${score}${score >= best && score > 0 ? ', a new best' : ''}.`, false);
    };
    if (Games.reduced()) finish(); else setTimeout(finish, 115);
  }
  function show(title, text, keep) {
    $('ov-title').textContent = title; $('ov-text').textContent = text;
    $('ov-keep').hidden = !keep;
    $('overlay').classList.add('on'); (keep ? $('ov-keep') : $('ov-new')).focus();
  }
  function newGame() {
    tiles = []; score = 0; prev = null; won = false; keepGoing = false;
    spawn(); spawn(); renderAll(); persist();
    $('overlay').classList.remove('on');
  }
  function undo() {
    if (!prev || busy) return;
    tiles = prev.tiles; score = prev.score; won = prev.won; keepGoing = prev.keepGoing; prev = null;
    $('overlay').classList.remove('on'); renderAll(); persist();
  }

  document.addEventListener('keydown', e => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    if (map[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); move(map[e.key]); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
  Games.swipe($('board'), move);
  $('new').addEventListener('click', () => { if (score === 0 || confirm('Start a new game?')) newGame(); });
  $('ov-new').addEventListener('click', newGame);
  $('ov-keep').addEventListener('click', () => { keepGoing = true; $('overlay').classList.remove('on'); persist(); });
  $('undo').addEventListener('click', undo);

  const saved = Games.load('2048', null);
  if (saved && Array.isArray(saved.tiles) && saved.tiles.length) {
    tiles = saved.tiles; score = saved.score || 0; won = !!saved.won; keepGoing = !!saved.keepGoing; nextId = saved.nextId || 1000;
    renderAll();
    if (!canMove()) show('Game over', `Score ${score}.`, false);
  } else newGame();
})();
