/* Sudoku: puzzles generated in the browser with a unique solution. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = window.GameAudio || { init() {}, sfx() {}, tempo() {} };
  A.init('sudoku');
  const CLUES = { easy: 40, medium: 32, hard: 26 };
  const ROW = i => Math.floor(i / 9), COL = i => i % 9, BOX = i => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const p = new Set();
    for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) p.add(j);
    return [...p];
  });

  /* ---------- solver and generator ---------- */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function candidates(g, i) {
    let used = 0;
    for (const j of PEERS[i]) if (g[j]) used |= 1 << g[j];
    const out = [];
    for (let n = 1; n <= 9; n++) if (!(used & (1 << n))) out.push(n);
    return out;
  }
  // count solutions up to limit, filling the emptiest-choice cell first
  function count(g, limit) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = candidates(g, i);
      if (!c.length) return 0;
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) return 1;
    let n = 0;
    for (const v of bestC) { g[best] = v; n += count(g, limit - n); if (n >= limit) break; }
    g[best] = 0;
    return n;
  }
  function fill(g) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const c = candidates(g, i);
      if (!c.length) return false;
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; }
    }
    if (best < 0) return true;
    for (const v of shuffle(bestC)) { g[best] = v; if (fill(g)) return true; }
    g[best] = 0;
    return false;
  }
  function generate(level) {
    const solution = new Array(81).fill(0);
    fill(solution);
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= CLUES[level]) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (count(puzzle.slice(), 2) !== 1) puzzle[i] = keep; else clues--;
    }
    return { puzzle, solution };
  }

  /* ---------- state ---------- */
  let S = null, sel = 40, notesMode = false;
  const cells = [];

  function fresh(level) {
    const { puzzle, solution } = generate(level);
    S = { level, puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0), history: [], elapsed: 0, won: false, hints: 0, check: S ? S.check : true };
    sel = puzzle.indexOf(0);
    persist(); render(); hideOverlay();
    $('msg').textContent = '';
  }
  function persist() { Games.save('sudoku', S); }

  /* ---------- board ---------- */
  function build() {
    const board = $('board');
    for (let i = 0; i < 81; i++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell'; b.setAttribute('role', 'gridcell');
      if (COL(i) % 3 === 2 && COL(i) < 8) b.classList.add('bx');
      if (ROW(i) % 3 === 2 && ROW(i) < 8) b.classList.add('by');
      b.tabIndex = -1;
      b.addEventListener('click', () => { sel = i; render(); });
      board.append(b); cells.push(b);
    }
    const pad = $('pad');
    for (let n = 1; n <= 9; n++) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.n = n;
      b.innerHTML = n + '<small></small>';
      b.setAttribute('aria-label', 'Number ' + n);
      b.addEventListener('click', () => input(n));
      pad.append(b);
    }
  }

  function render() {
    const v = S.values, selVal = v[sel];
    const counts = new Array(10).fill(0);
    v.forEach(x => { if (x) counts[x]++; });
    cells.forEach((c, i) => {
      const given = S.puzzle[i] !== 0;
      c.classList.toggle('given', given);
      c.classList.toggle('sel', i === sel);
      c.classList.toggle('peer', i !== sel && PEERS[sel].includes(i));
      c.classList.toggle('same', i !== sel && selVal && v[i] === selVal);
      const wrong = S.check && !given && v[i] && v[i] !== S.solution[i];
      c.classList.toggle('wrong', !!wrong);
      c.tabIndex = i === sel ? 0 : -1;
      if (v[i]) { c.textContent = v[i]; }
      else if (S.notes[i]) {
        c.textContent = '';
        const g = document.createElement('span'); g.className = 'notes-grid';
        for (let n = 1; n <= 9; n++) { const s = document.createElement('span'); s.textContent = S.notes[i] & (1 << n) ? n : ''; g.append(s); }
        c.append(g);
      } else c.textContent = '';
      c.setAttribute('aria-label', `Row ${ROW(i) + 1}, column ${COL(i) + 1}: ${v[i] || 'empty'}${given ? ', given' : ''}${wrong ? ', wrong' : ''}`);
    });
    $('pad').querySelectorAll('button').forEach(b => {
      const n = +b.dataset.n, left = 9 - counts[n];
      b.classList.toggle('done', left <= 0);
      b.querySelector('small').textContent = left > 0 ? left : '';
    });
    $('notes').setAttribute('aria-pressed', String(notesMode));
    $('notes').textContent = notesMode ? 'Notes on' : 'Notes';
    $('check').setAttribute('aria-pressed', String(S.check));
    $('undo').disabled = !S.history.length;
    document.querySelectorAll('#levels button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === S.level)));
    const best = Games.load('sudoku-best-' + S.level, null);
    $('best').textContent = best ? Games.time(best) : '–';
    $('time').textContent = Games.time(S.elapsed);
  }

  /* ---------- moves ---------- */
  function input(n) {
    if (S.won || S.puzzle[sel]) return;
    const i = sel;
    const step = { i, v: S.values[i], notes: S.notes[i], peers: [] };
    if (notesMode) {
      if (S.values[i]) return;
      S.notes[i] ^= 1 << n;
      A.sfx('click');
    } else {
      S.values[i] = S.values[i] === n ? 0 : n;
      S.notes[i] = 0;
      if (S.values[i]) PEERS[i].forEach(j => { if (S.notes[j] & (1 << n)) { step.peers.push([j, S.notes[j]]); S.notes[j] &= ~(1 << n); } });
      if (S.values[i]) A.sfx(S.check && S.values[i] !== S.solution[i] ? 'error' : 'place'); else A.sfx('click');
      if (!Games.reduced()) { cells[i].classList.remove('pop'); void cells[i].offsetWidth; cells[i].classList.add('pop'); }
    }
    S.history.push(step);
    if (S.history.length > 300) S.history.shift();
    after();
  }
  function erase() {
    if (S.won || S.puzzle[sel] || (!S.values[sel] && !S.notes[sel])) return;
    S.history.push({ i: sel, v: S.values[sel], notes: S.notes[sel], peers: [] });
    S.values[sel] = 0; S.notes[sel] = 0;
    A.sfx('click');
    after();
  }
  function undo() {
    const st = S.history.pop(); if (!st || S.won) return;
    S.values[st.i] = st.v; S.notes[st.i] = st.notes;
    st.peers.forEach(([j, m]) => { S.notes[j] = m; });
    sel = st.i; after();
  }
  function hint() {
    if (S.won) return;
    // the selected square if it is empty or wrong, otherwise the empty square with fewest options
    let i = sel;
    if (S.puzzle[i] || S.values[i] === S.solution[i]) {
      let bestN = 10; i = -1;
      for (let j = 0; j < 81; j++) if (S.values[j] !== S.solution[j]) { const c = candidates(S.values.map((x, k) => (x === S.solution[k] ? x : 0)), j).length; if (c < bestN) { bestN = c; i = j; } }
      if (i < 0) return;
    }
    S.history.push({ i, v: S.values[i], notes: S.notes[i], peers: [] });
    S.values[i] = S.solution[i]; S.notes[i] = 0; S.hints++; sel = i;
    $('msg').textContent = 'Hint used. Times with hints do not count as a best time.';
    after();
  }
  function after() {
    if (S.values.every((x, i) => x === S.solution[i])) win();
    persist(); render();
  }
  function win() {
    S.won = true;
    A.sfx('win', null, 0.15);
    const key = 'sudoku-best-' + S.level, best = Games.load(key, null);
    const record = !S.hints && (!best || S.elapsed < best);
    if (record) Games.save(key, S.elapsed);
    $('ov-title').textContent = 'Solved';
    $('ov-text').textContent = `${S.level[0].toUpperCase() + S.level.slice(1)} in ${Games.time(S.elapsed)}${record ? '. A new best time.' : S.hints ? ` with ${S.hints} hint${S.hints > 1 ? 's' : ''}.` : '.'}`;
    $('overlay').classList.add('on');
    $('ov-new').focus();
  }
  function hideOverlay() { $('overlay').classList.remove('on'); }

  /* ---------- timer ---------- */
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (S && !S.won && document.visibilityState === 'visible') { S.elapsed += now - last; $('time').textContent = Games.time(S.elapsed); if (Math.floor(S.elapsed / 1000) % 5 === 0) persist(); }
    last = now;
  }, 1000);
  document.addEventListener('visibilitychange', () => { last = Date.now(); if (S) persist(); });

  /* ---------- wiring ---------- */
  $('notes').addEventListener('click', () => { notesMode = !notesMode; render(); });
  $('erase').addEventListener('click', erase);
  $('undo').addEventListener('click', undo);
  $('hint').addEventListener('click', hint);
  $('check').addEventListener('click', () => { S.check = !S.check; persist(); render(); });
  $('new').addEventListener('click', () => { if (S.won || S.values.every((x, i) => x === S.puzzle[i]) || confirm('Start a new puzzle? This one will be lost.')) fresh(S.level); });
  $('ov-new').addEventListener('click', () => fresh(S.level));
  document.querySelectorAll('#levels button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.level === S.level && !S.won) return;
    if (S.won || S.values.every((x, i) => x === S.puzzle[i]) || confirm('Start a new ' + b.dataset.level + ' puzzle? This one will be lost.')) fresh(b.dataset.level);
  }));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select') || !S) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[k] !== undefined) {
      e.preventDefault();
      if (k === 'ArrowLeft' && COL(sel) === 0 || k === 'ArrowRight' && COL(sel) === 8) return;
      const n = sel + moves[k]; if (n >= 0 && n < 81) { sel = n; render(); cells[sel].focus(); }
    } else if (/^[1-9]$/.test(k)) { input(+k); }
    else if (k === 'Backspace' || k === 'Delete' || k === '0') { erase(); }
    else if (k === 'n' || k === 'N') { notesMode = !notesMode; render(); }
  });

  build();
  const saved = Games.load('sudoku', null);
  if (saved && saved.puzzle && saved.solution && !saved.won) { S = saved; sel = Math.max(0, saved.puzzle.indexOf(0)); render(); $('msg').textContent = 'Welcome back. Your puzzle is where you left it.'; }
  else fresh(saved && saved.level ? saved.level : 'easy');
})();
