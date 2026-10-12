/* Step 2: probabilities and the number of picks */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let st = Wheel.load();
  if (location.hash) history.replaceState(null, '', location.pathname);
  if (!Wheel.valid(st)) { location.replace('/games/wheel/'); return; }
  // keep only named elements from here on
  st.items = st.items.filter(i => i.name.trim());
  const fmt = v => (Math.round(v * 10) / 10).toString();

  function render() {
    const ol = $('odds'); ol.textContent = '';
    st.items.forEach((it, i) => {
      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = Wheel.COLORS[i % Wheel.COLORS.length]; sw.textContent = i + 1; sw.setAttribute('aria-hidden', 'true');
      sw.style.cssText += ';width:1.6rem;height:1.6rem;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:0.75rem;font-weight:700';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = it.name;
      const lab = document.createElement('label');
      const inp = document.createElement('input'); inp.className = 'field'; inp.type = 'number'; inp.min = '0'; inp.step = '0.1'; inp.inputMode = 'decimal'; inp.enterKeyHint = 'next';
      inp.value = fmt(it.weight); inp.setAttribute('aria-label', 'Probability for ' + it.name + ', percent');
      inp.addEventListener('input', () => { const v = parseFloat(inp.value.replace(',', '.')); it.weight = Number.isFinite(v) && v >= 0 ? v : 0; update(); });
      lab.append(inp, document.createTextNode('%'));
      const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); fill.style.background = Wheel.COLORS[i % Wheel.COLORS.length]; bar.append(fill);
      li.append(sw, nm, lab, bar); ol.append(li);
    });
    $('picks').value = st.picks; $('repeat').checked = st.repeat;
    update();
  }
  function update() {
    const sum = st.items.reduce((a, b) => a + b.weight, 0);
    const ps = Wheel.probs(st);
    $('odds').querySelectorAll('.bar i').forEach((f, i) => { f.style.width = (ps[i].p * 100) + '%'; });
    const box = $('sum'); box.textContent = '';
    const off = Math.abs(sum - 100) > 0.05;
    box.classList.toggle('off', off && sum > 0);
    const t = document.createElement('span');
    t.textContent = sum === 0 ? 'All zero: every element gets the same chance.' : off ? `The numbers add up to ${fmt(sum)}%. The poster scales them to 100%: ${ps.map(p => Wheel.pct1(p.p)).join(', ')}.` : 'The numbers add up to 100%.';
    box.append(t);
    const n = st.items.length;
    if (!st.repeat && st.picks > n) st.picks = n;
    $('picks').max = st.repeat ? 100 : n;
    $('pick-hint').textContent = st.repeat
      ? `The wheel spins ${st.picks} time${st.picks > 1 ? 's' : ''}, with the same odds every time.`
      : st.picks > 1 ? `The wheel picks ${st.picks} different elements. After each pick that element is removed and the others share its probability in proportion, so later odds are higher than on the poster.` : 'The wheel picks one element.';
    Wheel.draw($('preview'), ps, { names: false });
    Wheel.save(st); Wheel.steps(1, st);
  }
  $('picks').addEventListener('input', e => { const v = Math.round(+e.target.value); if (v >= 1) { st.picks = Math.min(v, st.repeat ? 100 : st.items.length); update(); } });
  $('picks').addEventListener('change', () => { $('picks').value = st.picks; });
  $('repeat').addEventListener('change', e => { st.repeat = e.target.checked; update(); $('picks').value = st.picks; });
  $('equal').addEventListener('click', () => { const w = Math.round(1000 / st.items.length) / 10; st.items.forEach(i => { i.weight = w; }); render(); });
  $('normalize').addEventListener('click', () => {
    const ps = Wheel.probs(st);
    // round to one decimal and give any rounding gap to the largest element, so the total is exactly 100
    st.items.forEach((it, i) => { it.weight = Math.round(ps[i].p * 1000) / 10; });
    const gap = Math.round((100 - st.items.reduce((a, b) => a + b.weight, 0)) * 10) / 10;
    if (gap) { const k = st.items.reduce((m, it, i, a) => (it.weight > a[m].weight ? i : m), 0); st.items[k].weight = Math.round((st.items[k].weight + gap) * 10) / 10; }
    render();
  });
  render();
})();
