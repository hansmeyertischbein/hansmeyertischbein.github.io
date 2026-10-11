/* Weekly schedule chart for the agents page */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var box = document.getElementById('week');
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var RUNS = [
    { name: 'Morning digest', time: '06:56', color: 'var(--c2)', days: [0, 1, 2, 3, 4] },
    { name: 'Pre-market brief', time: '08:45', color: 'var(--c1)', days: [0, 1, 2, 3, 4] },
    { name: 'Post-open brief', time: '09:15', color: 'var(--c1)', days: [0, 1, 2, 3, 4] },
    { name: 'Market analysis', time: '17:52', color: 'var(--c3)', days: [6] }
  ];
  function s(tag, a, p) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); if (p) p.appendChild(n); return n; }
  function draw() {
    box.textContent = '';
    var W = Math.max(300, box.clientWidth), narrow = W < 520;
    var padL = narrow ? 128 : 170, padT = 26, row = 34, H = padT + row * RUNS.length + 4;
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, box);
    var iw = W - padL - 4;
    var X = function (d) { return padL + iw * (d + 0.5) / 7; };
    DAYS.forEach(function (d, i) { var t = s('text', { class: 'day', x: X(i), y: 14, 'text-anchor': 'middle' }, svg); t.textContent = narrow ? d.slice(0, 1) : d; });
    RUNS.forEach(function (r, k) {
      var y = padT + row * k + row / 2;
      s('line', { class: 'grid', x1: padL, x2: padL + iw, y1: y, y2: y }, svg);
      var t = s('text', { x: 0, y: y + 4 }, svg);
      var tm = s('tspan', { class: 'day' }, t); tm.textContent = r.time + ' ';
      var nm = s('tspan', {}, t); nm.textContent = r.name;
      r.days.forEach(function (d) { s('circle', { class: 'mark', cx: X(d), cy: y, r: 7, fill: r.color }, svg); });
    });
  }
  var leg = document.getElementById('week-legend');
  [RUNS[0], RUNS[1], RUNS[3]].forEach(function (r) {
    var li = document.createElement('li'), i = document.createElement('i');
    i.className = 'sq'; i.style.color = r.color; i.style.borderRadius = '50%';
    li.appendChild(i); li.appendChild(document.createTextNode(r === RUNS[1] ? 'Market briefs' : r.name)); leg.appendChild(li);
  });
  draw();
  var lastW = box.clientWidth;
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (box.clientWidth !== lastW) { lastW = box.clientWidth; draw(); } }).observe(box);
})();
