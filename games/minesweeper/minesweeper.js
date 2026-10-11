/* Minesweeper: safe first click, flags by right-click, long-press or Flag mode, and chording. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [16, 30, 99] };
  let level = Games.load('mines-level', 'easy'), rows, cols, mines, cells, btns = [], started, over, opened, flags, t0, elapsed, flagMode = false;
  const board = $('board');

  function dims() {
    let [r, c, m] = LEVELS[level];
    // on a narrow screen, turn the wide board on its side
    if (c > r && board.parentElement.clientWidth < c * 26) [r, c] = [c, r];
    return [r, c, m];
  }
  function cellSize() {
    const w = board.parentElement.clientWidth - 4;
    return Math.max(22, Math.min(40, Math.floor(w / cols)));
  }
  function neighbours(i) {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc);
    }
    return out;
  }
  function newGame() {
    [rows, cols, mines] = dims();
    cells = Array.from({ length: rows * cols }, () => ({ mine: false, n: 0, open: false, flag: false }));
    started = false; over = false; opened = 0; flags = 0; elapsed = 0; t0 = 0;
    board.style.setProperty('--cols', cols);
    board.style.setProperty('--cell', cellSize() + 'px');
    board.textContent = ''; btns = [];
    for (let i = 0; i < rows * cols; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mine-cell'; b.setAttribute('role', 'gridcell'); b.tabIndex = i === 0 ? 0 : -1;
      if ((i + 1) % cols === 0) b.style.borderRight = '0';
      if (i >= (rows - 1) * cols) b.style.borderBottom = '0';
      board.append(b); btns.push(b);
    }
    $('overlay').classList.remove('on');
    document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
    const best = Games.load('mines-best-' + level, null);
    $('best').textContent = best ? Games.time(best) : '–';
    hud(); paint();
  }
  function lay(safe) {
    const banned = new Set([safe, ...neighbours(safe)]);
    const pool = [...Array(rows * cols).keys()].filter(i => !banned.has(i));
    for (let k = 0; k < mines; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; cells[pool[k]].mine = true; }
    cells.forEach((c, i) => { c.n = neighbours(i).filter(j => cells[j].mine).length; });
    started = true; t0 = Date.now();
  }
  function open(i) {
    if (over) return;
    if (!started) lay(i);
    const c = cells[i];
    if (c.flag) return;
    if (c.open) { chord(i); return; }
    if (c.mine) { lose(i); return; }
    // flood fill from empty squares
    const stack = [i];
    while (stack.length) {
      const j = stack.pop(), d = cells[j];
      if (d.open || d.flag) continue;
      d.open = true; opened++;
      if (d.n === 0) neighbours(j).forEach(k => { if (!cells[k].open && !cells[k].mine) stack.push(k); });
    }
    if (opened === rows * cols - mines) win();
    paint(); hud();
  }
  function chord(i) {
    const c = cells[i]; if (!c.open || !c.n) return;
    const nb = neighbours(i);
    if (nb.filter(j => cells[j].flag).length !== c.n) return;
    for (const j of nb) if (!cells[j].open && !cells[j].flag) { if (cells[j].mine) { lose(j); return; } open(j); if (over) return; }
  }
  function flag(i) {
    if (over || cells[i].open) return;
    cells[i].flag = !cells[i].flag; flags += cells[i].flag ? 1 : -1;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* ignore */ }
    paint(); hud();
  }
  function lose(i) {
    over = true; elapsed = Date.now() - t0;
    cells.forEach((c, j) => { if (c.mine) c.open = true; });
    paint(); btns[i].classList.add('boom');
    cells.forEach((c, j) => { if (c.flag && !c.mine) btns[j].classList.add('wrongflag'); });
    setTimeout(() => show('Boom', 'You hit a mine. Try again.'), Games.reduced() ? 0 : 500);
  }
  function win() {
    over = true; elapsed = Date.now() - t0;
    cells.forEach(c => { if (c.mine && !c.flag) { c.flag = true; flags++; } });
    const key = 'mines-best-' + level, best = Games.load(key, null), record = !best || elapsed < best;
    if (record) Games.save(key, elapsed);
    show('Cleared', `${level[0].toUpperCase() + level.slice(1)} in ${Games.time(elapsed)}${record ? '. A new best time.' : '.'}`);
    $('best').textContent = Games.time(record ? elapsed : best);
  }
  function show(t, p) { $('ov-title').textContent = t; $('ov-text').textContent = p; $('overlay').classList.add('on'); $('ov-new').focus(); hud(); }
  function paint() {
    cells.forEach((c, i) => {
      const b = btns[i];
      b.className = 'mine-cell' + (c.open ? ' open' : '') + (c.flag && !c.open ? ' flag' : '') + (c.open && c.mine ? ' mine' : '') + (c.open && !c.mine && c.n ? ' n' + Math.min(c.n, 4) : '');
      b.textContent = c.open && !c.mine && c.n ? c.n : '';
      const r = Math.floor(i / cols) + 1, col = (i % cols) + 1;
      b.setAttribute('aria-label', `Row ${r}, column ${col}: ${c.open ? (c.mine ? 'mine' : c.n ? c.n + ' mines around' : 'empty') : c.flag ? 'flagged' : 'closed'}`);
    });
  }
  function hud() {
    $('left').textContent = mines - flags;
    $('time').textContent = Games.time(over ? elapsed : started ? Date.now() - t0 : 0);
  }
  setInterval(() => { if (started && !over) hud(); }, 500);

  // input: click, right-click, long-press, keyboard
  let press = null;
  const idx = e => btns.indexOf(e.target.closest('.mine-cell'));
  let lastTouch = 0;
  board.addEventListener('contextmenu', e => { e.preventDefault(); const i = idx(e); if (i >= 0 && e.pointerType !== 'touch' && Date.now() - lastTouch > 900) flag(i); });
  board.addEventListener('pointerdown', e => {
    const i = idx(e); if (i < 0) return;
    if (e.pointerType !== 'mouse') lastTouch = Date.now();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    press = { i, x: e.clientX, y: e.clientY, long: false, timer: setTimeout(() => { if (press) { press.long = true; flag(press.i); } }, 420) };
  });
  board.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; } });
  board.addEventListener('pointerup', e => {
    if (!press) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.long || idx(e) !== p.i) return;
    (flagMode && !cells[p.i].open ? flag : open)(p.i);
  });
  board.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });
  board.addEventListener('keydown', e => {
    const i = idx(e); if (i < 0) return;
    const mv = { ArrowUp: -cols, ArrowDown: cols, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (mv !== undefined) {
      e.preventDefault(); const n = i + mv;
      if (n < 0 || n >= rows * cols || (e.key === 'ArrowLeft' && i % cols === 0) || (e.key === 'ArrowRight' && i % cols === cols - 1)) return;
      btns[i].tabIndex = -1; btns[n].tabIndex = 0; btns[n].focus();
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
    else if (e.key === 'f' || e.key === 'F') { flag(i); }
  });

  function setMode(f) { flagMode = f; $('mode-dig').setAttribute('aria-pressed', String(!f)); $('mode-flag').setAttribute('aria-pressed', String(f)); }
  $('mode-dig').addEventListener('click', () => setMode(false));
  $('mode-flag').addEventListener('click', () => setMode(true));
  $('new').addEventListener('click', newGame);
  $('ov-new').addEventListener('click', newGame);
  document.querySelectorAll('#levels button').forEach(b => b.addEventListener('click', () => { level = b.dataset.level; Games.save('mines-level', level); newGame(); }));
  let lastW = 0;
  new ResizeObserver(() => { const w = board.parentElement.clientWidth; if (Math.abs(w - lastW) > 30) { lastW = w; if (!started) newGame(); else board.style.setProperty('--cell', cellSize() + 'px'); } }).observe(board.parentElement);
  newGame();
})();
