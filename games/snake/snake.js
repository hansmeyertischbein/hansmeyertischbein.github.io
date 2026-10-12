/* Snake on a canvas: arrow keys, WASD, swipes or on-screen buttons. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = window.GameAudio || { init() {}, sfx() {}, tempo() {} };
  A.init('snake');
  const N = 20, canvas = $('board'), ctx = canvas.getContext('2d');
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  let snake, dir, queue, food, score, timer = null, running = false, over = false, walls = Games.load('snake-walls', true);
  let size = 0;

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function resize() {
    const w = canvas.clientWidth, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    size = canvas.width / N;
    draw();
  }
  function reset() {
    snake = [[9, 10], [8, 10], [7, 10]]; dir = 'right'; queue = []; score = 0; over = false;
    placeFood(); $('score').textContent = '0';
  }
  function placeFood() {
    const free = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!snake.some(s => s[0] === x && s[1] === y)) free.push([x, y]);
    food = free[Math.floor(Math.random() * free.length)];
  }
  const speed = () => Math.max(55, 140 - snake.length * 2.5);
  function tick() {
    if (queue.length) dir = queue.shift();
    const [dx, dy] = DIRS[dir];
    let x = snake[0][0] + dx, y = snake[0][1] + dy;
    if (!walls) { x = (x + N) % N; y = (y + N) % N; }
    const eating = food && x === food[0] && y === food[1];
    const body = eating ? snake : snake.slice(0, -1);
    if (x < 0 || y < 0 || x >= N || y >= N || body.some(s => s[0] === x && s[1] === y)) return die();
    snake.unshift([x, y]);
    if (eating) { score++; $('score').textContent = score; placeFood(); A.sfx('eat'); A.tempo(Math.min(176, 138 + snake.length)); } else snake.pop();
    draw();
    timer = setTimeout(tick, speed());
  }
  function die() {
    running = false; over = true; clearTimeout(timer);
    A.sfx('die'); A.tempo(138);
    const key = 'snake-best-' + (walls ? 'walls' : 'wrap'), best = Games.load(key, 0);
    if (score > best) Games.save(key, score);
    showBest();
    draw(true);
    $('ov-title').textContent = score > best ? 'New best!' : 'Game over';
    $('ov-text').textContent = `You scored ${score}.`;
    $('start').textContent = 'Play again';
    $('overlay').classList.add('on'); $('start').focus();
    $('pause').disabled = true;
  }
  function start() {
    if (over || !snake) reset();
    $('overlay').classList.remove('on');
    running = true; $('pause').disabled = false; $('pause').textContent = 'Pause';
    clearTimeout(timer); timer = setTimeout(tick, speed());
    draw();
  }
  function pause() {
    if (!running) return start();
    running = false; clearTimeout(timer);
    $('ov-title').textContent = 'Paused'; $('ov-text').textContent = `Score ${score}.`; $('start').textContent = 'Resume';
    $('overlay').classList.add('on'); $('pause').textContent = 'Resume';
  }
  function turn(d) {
    if (!running) return;
    const lastDir = queue.length ? queue[queue.length - 1] : dir;
    if (d === lastDir || d === OPP[lastDir] || queue.length > 2) return;
    queue.push(d);
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
  function draw(dead) {
    if (!size || !snake) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // faint grid dots
    ctx.fillStyle = css('--rule');
    for (let x = 1; x < N; x++) for (let y = 1; y < N; y++) ctx.fillRect(x * size - 1, y * size - 1, 2, 2);
    if (food) { ctx.fillStyle = css('--c2'); ctx.beginPath(); ctx.arc((food[0] + 0.5) * size, (food[1] + 0.5) * size, size * 0.36, 0, Math.PI * 2); ctx.fill(); }
    const pad = size * 0.08;
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? css('--ink') : css('--c3');
      ctx.globalAlpha = dead && i > 0 ? 0.5 : 1;
      rr(s[0] * size + pad, s[1] * size + pad, size - 2 * pad, size - 2 * pad, size * 0.25);
    });
    ctx.globalAlpha = 1;
    // eyes on the head
    const [hx, hy] = snake[0], [dx, dy] = DIRS[dir];
    ctx.fillStyle = css('--paper');
    [[-1, 1], [1, 1]].forEach(([a]) => {
      const ex = (hx + 0.5 + dx * 0.18 + (dy ? a * 0.2 : 0)) * size, ey = (hy + 0.5 + dy * 0.18 + (dx ? a * 0.2 : 0)) * size;
      ctx.beginPath(); ctx.arc(ex, ey, size * 0.08, 0, Math.PI * 2); ctx.fill();
    });
  }
  function showBest() { $('best').textContent = Games.load('snake-best-' + (walls ? 'walls' : 'wrap'), 0); }
  function setMode(w) {
    walls = w; Games.save('snake-walls', w);
    document.querySelectorAll('#mode button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.walls === '1') === walls)));
    showBest();
  }

  document.addEventListener('keydown', e => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    if (map[e.key]) { e.preventDefault(); if (!running) start(); turn(map[e.key]); }
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); running ? pause() : start(); }
  });
  Games.swipe(canvas, d => { if (!running) start(); turn(d); });
  document.querySelectorAll('.dpad button').forEach(b => b.addEventListener('click', () => { if (!running) start(); turn(b.dataset.dir); }));
  $('start').addEventListener('click', start);
  $('pause').addEventListener('click', pause);
  document.querySelectorAll('#mode button').forEach(b => b.addEventListener('click', () => {
    setMode(b.dataset.walls === '1');
    if (running) { pause(); }
  }));
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
  new ResizeObserver(resize).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw());
  setMode(walls); reset(); resize();
})();
