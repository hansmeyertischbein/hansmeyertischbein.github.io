/* Step 3: the poster, and spinning it */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let st = Wheel.load();
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (!Wheel.valid(st)) { location.replace('/games/wheel/'); return; }
  const all = Wheel.probs(st);
  let left = all.map((x, i) => ({ ...x, i }));   // elements still in play
  let angle = 0, results = [], spinning = false;
  let wheel = null;

  function poster() {
    $('p-title').textContent = st.title.trim() || 'Spin the wheel';
    $('wheel').setAttribute('aria-label', 'Wheel with ' + all.map(p => `${p.name} ${Wheel.pct1(p.p)}`).join(', '));
    const ol = $('dist'); ol.textContent = '';
    all.forEach((p, i) => {
      const li = document.createElement('li'); li.id = 'd' + i;
      const sw = document.createElement('span'); sw.className = 'sw'; sw.textContent = i + 1; sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText = `width:1.6rem;height:1.6rem;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:0.75rem;font-weight:700;background:${Wheel.COLORS[i % Wheel.COLORS.length]}`;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name;
      const pc = document.createElement('span'); pc.className = 'pc'; pc.textContent = Wheel.pct1(p.p);
      li.append(sw, nm, pc); ol.append(li);
    });
    const sum = all.reduce((a, p) => a + Math.round(p.p * 1000) / 10, 0);
    const parts = [];
    parts.push(st.picks === 1 ? 'One pick.' : st.repeat ? `${st.picks} picks, same odds every time.` : `${st.picks} picks of different elements. A picked element leaves the wheel.`);
    if (Math.abs(sum - 100) > 0.05) parts.push(`Shares are rounded to one decimal, so they add up to ${sum.toFixed(1)}%.`);
    parts.push('Each slice is as wide as its probability.');
    $('p-foot').textContent = parts.join(' ');
    wheel = Wheel.draw($('wheel'), left.map(x => ({ name: x.name, p: x.p })));
    // keep slice numbers matching the poster even after elements leave the wheel
    renumber();
  }
  function renumber() {
    const labels = $('wheel').querySelectorAll('.wheel-label');
    let k = 0;
    wheel.slices.forEach((sl, j) => { if (sl.a1 - sl.a0 >= 0.13) { labels[k].textContent = left[j].i + 1; k++; } });
    $('wheel').querySelectorAll('.wheel-rot path, .wheel-rot circle').forEach((el, j) => { if (j < left.length && el.tagName === 'path') el.setAttribute('fill', Wheel.COLORS[left[j].i % Wheel.COLORS.length]); });
    if (left.length === 1) { const c = $('wheel').querySelector('.wheel-rot circle'); if (c) c.setAttribute('fill', Wheel.COLORS[left[0].i % Wheel.COLORS.length]); }
  }
  function status() {
    const done = results.length >= st.picks;
    $('spin').disabled = spinning || done;
    $('spin').textContent = done ? 'All picks made' : results.length ? `Spin again (${results.length + 1} of ${st.picks})` : st.picks > 1 ? `Spin (1 of ${st.picks})` : 'Spin';
    const ol = $('results'); ol.textContent = '';
    if (st.picks > 1) results.forEach(r => { const li = document.createElement('li'); li.textContent = r; ol.append(li); });
  }
  async function spin() {
    if (spinning || results.length >= st.picks) return;
    spinning = true; status();
    $('result').textContent = '';
    document.querySelectorAll('.dist li').forEach(li => li.classList.remove('won'));
    const idx = Wheel.pick(left);
    angle = await Wheel.spin(wheel, idx, angle);
    const won = left[idx];
    results.push(won.name);
    $('result').textContent = st.picks > 1 ? `Pick ${results.length}: ${won.name}` : won.name;
    $('d' + won.i).classList.add('won');
    spinning = false;
    if (!st.repeat && results.length < st.picks) {
      // remove the winner and redraw with the remaining odds after a short pause
      setTimeout(() => {
        left = left.filter((_, j) => j !== idx);
        const tot = left.reduce((a, b) => a + b.p, 0);
        left = left.map(x => ({ ...x, p: x.p / tot }));
        angle = 0;
        wheel = Wheel.draw($('wheel'), left.map(x => ({ name: x.name, p: x.p })));
        renumber(); status();
      }, 900);
    }
    status();
  }
  $('spin').addEventListener('click', spin);
  $('reset-draw').addEventListener('click', () => { if (spinning) return; left = all.map((x, i) => ({ ...x, i })); results = []; angle = 0; $('result').textContent = ''; poster(); status(); });
  $('print').addEventListener('click', () => {
    // print the full wheel, not one with elements already picked
    if (!st.repeat && left.length !== all.length) { left = all.map((x, i) => ({ ...x, i })); results = []; angle = 0; poster(); status(); }
    window.print();
  });
  $('share').addEventListener('click', async () => {
    const url = location.origin + Wheel.linkTo('/games/wheel/poster/', st);
    try { await navigator.clipboard.writeText(url); $('share').textContent = 'Link copied'; }
    catch (e) { prompt('Copy this link:', url); }
    setTimeout(() => { $('share').textContent = 'Copy link'; }, 2000);
  });
  Wheel.steps(2, st);
  poster(); status();
})();
