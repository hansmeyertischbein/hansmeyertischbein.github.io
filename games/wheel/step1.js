/* Step 1: the elements on the wheel */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  if (window.GameAudio) GameAudio.init('wheel');
  let st = Wheel.load();
  // drop the state from the address bar once it is read
  if (location.hash) history.replaceState(null, '', location.pathname);

  function commit() { Wheel.save(st); Wheel.steps(0, st); msg(); }
  function msg() {
    const n = Wheel.usable(st).length;
    $('msg').textContent = n < 2 ? 'Add at least two elements to continue.' : `${n} elements on the wheel.`;
  }
  function render(focusIndex) {
    $('title').value = st.title;
    const ol = $('items'); ol.textContent = '';
    st.items.forEach((it, i) => {
      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = Wheel.COLORS[i % Wheel.COLORS.length]; sw.textContent = i + 1; sw.setAttribute('aria-hidden', 'true');
      const inp = document.createElement('input'); inp.className = 'field'; inp.value = it.name; inp.maxLength = 60; inp.placeholder = 'Element ' + (i + 1); inp.enterKeyHint = 'next';
      inp.setAttribute('aria-label', 'Element ' + (i + 1));
      inp.addEventListener('input', () => { it.name = inp.value; commit(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (i === st.items.length - 1) add(); else ol.querySelectorAll('input')[i + 1].focus(); } });
      const tools = document.createElement('div'); tools.className = 'row-tools';
      const b = (label, aria, fn, dis) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn btn-quiet'; x.textContent = label; x.setAttribute('aria-label', aria); x.disabled = !!dis; x.addEventListener('click', fn); tools.append(x); };
      b('↑', 'Move up', () => { [st.items[i - 1], st.items[i]] = [st.items[i], st.items[i - 1]]; commit(); render(); }, i === 0);
      b('↓', 'Move down', () => { [st.items[i + 1], st.items[i]] = [st.items[i], st.items[i + 1]]; commit(); render(); }, i === st.items.length - 1);
      b('×', 'Remove', () => { st.items.splice(i, 1); commit(); render(); });
      li.append(sw, inp, tools); ol.append(li);
    });
    commit();
    if (focusIndex != null) ol.querySelectorAll('input')[focusIndex]?.focus();
  }
  function add() {
    if (st.items.length >= 24) { $('msg').textContent = 'A wheel can hold up to 24 elements.'; return; }
    const known = st.items.filter(i => i.name.trim());
    const avg = known.length ? known.reduce((a, b) => a + b.weight, 0) / known.length : 10;
    st.items.push({ name: '', weight: Math.round(avg * 10) / 10 || 10 });
    render(st.items.length - 1);
  }
  $('title').addEventListener('input', e => { st.title = e.target.value; commit(); });
  $('add').addEventListener('click', add);
  $('example').addEventListener('click', () => { st = JSON.parse(JSON.stringify(Wheel.EXAMPLE)); render(); });
  $('clear').addEventListener('click', () => { st = { title: '', items: [{ name: '', weight: 50 }, { name: '', weight: 50 }], picks: 1, repeat: false }; render(0); });
  $('use-paste').addEventListener('click', () => {
    const names = $('paste').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 24);
    if (names.length < 2) { $('msg').textContent = 'Paste at least two lines.'; return; }
    st.items = names.map(n => ({ name: n.slice(0, 60), weight: Math.round(1000 / names.length) / 10 }));
    $('paste').value = ''; render();
  });
  render();
})();
