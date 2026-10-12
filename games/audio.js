/* Generated music and sound effects for the games, made live with the Web Audio API.
 * Every game has its own theme: a chord progression, a groove and a melody that is
 * improvised from the chords, so it never repeats exactly. No audio files are loaded.
 *
 *   GameAudio.init('snake')   start the theme for a page (plays after the first tap or key)
 *   GameAudio.sfx('eat')      play a sound effect
 * Settings (music, effects, volume) are shared by all games and saved in this browser.
 */
window.GameAudio = (function () {
  'use strict';
  const KEY = 'games:sound';
  const DEFAULTS = { music: true, sfx: true, volume: 0.6 };
  let S = load();
  let ctx = null, master, musicBus, sfxBus, noiseBuf = null;
  let theme = null, themeName = null, playing = false, timer = null, nextTime = 0, step = 0, unlocked = false;
  let rng = mulberry(1);

  function load() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return Object.assign({}, DEFAULTS); } }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------- audio graph ---------- */
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = S.volume;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /* ---------- instruments ---------- */
  function tone(f, t, dur, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.01, r = o.release ?? 0.12, peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak * (o.sustain ?? 0.7), t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    let node = osc;
    if (o.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; osc.connect(f2); node = f2; }
    node.connect(g); g.connect(o.dest || musicBus);
    osc.start(t); osc.stop(t + dur + r + 0.05);
  }
  function noise(t, dur, o = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'highpass'; f.frequency.value = o.freq || 7000; f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.gain ?? 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || musicBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const kick = (t, v = 0.5) => tone(110, t, 0.12, { slide: 40, gain: v, attack: 0.002, release: 0.08, sustain: 0.4 });
  const snare = (t, v = 0.12) => { noise(t, 0.16, { filter: 'bandpass', freq: 1800, q: 0.7, gain: v }); tone(190, t, 0.05, { gain: v * 0.8, type: 'triangle', release: 0.05 }); };
  const hat = (t, v = 0.035) => noise(t, 0.04, { gain: v });
  const clap = (t, v = 0.1) => { [0, 0.012, 0.024].forEach(d => noise(t + d, 0.09, { filter: 'bandpass', freq: 1200, q: 1.2, gain: v })); };

  /* ---------- themes ---------- */
  // chord: [root midi, intervals]; every theme gets step(s, t, sixteenth) for each 16th note
  const pick = a => a[Math.floor(rng() * a.length)];
  const THEMES = {
    // calm, no drums, for concentrating
    sudoku: {
      bpm: 68,
      chords: [[48, [0, 4, 7, 11, 14]], [45, [0, 3, 7, 10, 14]], [41, [0, 4, 7, 11, 14]], [43, [0, 4, 7, 9, 14]]],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, [root, iv] = this.chords[bar];
        if (i === 0) iv.slice(0, 4).forEach((x, k) => tone(hz(root + 12 + x), t + k * 0.02, q * 15, { type: 'sine', gain: 0.045, attack: 0.9, release: 1.2, sustain: 0.8 }));
        if (i === 0) tone(hz(root - 12), t, q * 14, { type: 'sine', gain: 0.09, attack: 0.3, release: 0.8 });
        if ([0, 3, 6, 10, 12].includes(i) && rng() < 0.75) tone(hz(root + 24 + pick(iv)), t, q * 3, { type: 'triangle', gain: 0.05, attack: 0.02, release: 0.6, lp: 2400 });
      }
    },
    // fast chiptune
    snake: {
      bpm: 138,
      chords: [[57, [0, 3, 7]], [53, [0, 4, 7]], [48, [0, 4, 7]], [55, [0, 4, 7]]],
      scale: [0, 3, 5, 7, 10],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, [root, iv] = this.chords[bar];
        if (i % 2 === 0) tone(hz(root - 24 + (i % 4 === 2 ? 12 : 0)), t, q * 1.6, { type: 'triangle', gain: 0.16, release: 0.04 });
        if (i % 8 === 0) kick(t, 0.45);
        if (i % 8 === 4) snare(t, 0.1);
        if (i % 2 === 0) hat(t, i % 4 === 2 ? 0.04 : 0.025);
        if (rng() < (i % 4 === 0 ? 0.8 : 0.35)) {
          const n = 57 + 12 + pick(this.scale) + (rng() < 0.2 ? 12 : 0);
          tone(hz(n), t, q * 0.9, { type: 'square', gain: 0.045, release: 0.03, lp: 3200 });
        }
        if (i === 0 || i === 8) iv.forEach(x => tone(hz(root + x), t, q * 1.5, { type: 'square', gain: 0.018, release: 0.05, lp: 1800 }));
      }
    },
    // laid-back lo-fi with swing
    2048: {
      bpm: 88, swing: 0.18,
      chords: [[50, [0, 3, 7, 10, 14]], [43, [0, 4, 10, 14, 21]], [48, [0, 4, 7, 11, 14]], [45, [0, 3, 7, 10, 14]]],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, [root, iv] = this.chords[bar];
        if (i === 0 || i === 6) iv.forEach((x, k) => tone(hz(root + 12 + x), t + k * 0.012, q * (i === 0 ? 5 : 3), { type: 'sine', gain: 0.04, detune: k % 2 ? 6 : -6, attack: 0.01, release: 0.5, lp: 2000 }));
        if ([0, 7, 10].includes(i)) tone(hz(root - 12 + (i === 10 ? 7 : 0)), t, q * 2, { type: 'triangle', gain: 0.17, release: 0.15, lp: 900 });
        if (i === 0 || i === 10) kick(t, 0.4);
        if (i === 4 || i === 12) snare(t, 0.07);
        if (i % 2 === 0) hat(t, 0.022);
        if ((i === 3 || i === 9 || i === 14) && rng() < 0.5) tone(hz(root + 24 + pick(iv)), t, q * 2, { type: 'triangle', gain: 0.035, release: 0.4, lp: 3000 });
      }
    },
    // quiet tension: pulsing bass, ticking hats, the odd bell
    minesweeper: {
      bpm: 92,
      chords: [[40, [0, 7, 15]], [36, [0, 7, 16]], [45, [0, 7, 15]], [35, [0, 7, 16]]],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, [root, iv] = this.chords[bar];
        if (i % 2 === 0) tone(hz(root), t, q * 1.4, { type: 'sawtooth', gain: 0.07, release: 0.06, lp: 380 });
        hat(t, i % 4 === 0 ? 0.03 : 0.012);
        if (i === 0) kick(t, 0.3);
        if (i === 0) iv.forEach(x => tone(hz(root + 24 + x), t, q * 15, { type: 'sine', gain: 0.025, attack: 1.2, release: 1 }));
        if ((i === 6 || i === 13) && rng() < 0.35) tone(hz(root + 36 + pick([0, 3, 7, 10, 12])), t, q * 4, { type: 'sine', gain: 0.04, attack: 0.005, release: 1.2 });
      }
    },
    // bouncy game-show
    wheel: {
      bpm: 116,
      chords: [[48, [0, 4, 7]], [53, [0, 4, 7]], [55, [0, 4, 7]], [48, [0, 4, 7]]],
      scale: [0, 2, 4, 7, 9],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 4, i = s % 16, [root, iv] = this.chords[bar];
        if (i % 4 === 0) tone(hz(root - 12 + (i % 8 === 4 ? 7 : 0)), t, q * 1.8, { type: 'triangle', gain: 0.16, release: 0.08 });
        if (i % 4 === 2) iv.forEach(x => tone(hz(root + 12 + x), t, q * 1.2, { type: 'square', gain: 0.02, release: 0.05, lp: 2200 }));
        if (i % 8 === 0) kick(t, 0.4);
        if (i % 8 === 4) clap(t, 0.07);
        if (i % 2 === 1) hat(t, 0.02);
        if (i % 2 === 0 && rng() < 0.55) tone(hz(60 + 12 + pick(this.scale)), t, q * 1.6, { type: 'triangle', gain: 0.06, release: 0.12 });
      }
    },
    // the games overview: soft and short
    lobby: {
      bpm: 80,
      chords: [[48, [0, 4, 7, 11]], [53, [0, 4, 7, 11]]],
      step(s, t, q) {
        const bar = Math.floor(s / 16) % 2, i = s % 16, [root, iv] = this.chords[bar];
        if (i === 0) iv.forEach(x => tone(hz(root + 12 + x), t, q * 15, { type: 'sine', gain: 0.035, attack: 0.8, release: 1 }));
        if (i % 4 === 0 && rng() < 0.6) tone(hz(root + 24 + pick(iv)), t, q * 3, { type: 'triangle', gain: 0.04, release: 0.5 });
      }
    }
  };

  /* ---------- scheduler ---------- */
  function sixteenth() { return 60 / theme.bpm / 4; }
  function schedule() {
    const q = sixteenth();
    while (nextTime < ctx.currentTime + 0.12) {
      const swing = theme.swing && step % 2 === 1 ? q * theme.swing : 0;
      if (step % 64 === 0) rng = mulberry(Math.floor(Math.random() * 1e9));
      try { theme.step(step, nextTime + swing, q); } catch (e) { errors++; /* never let music break a game */ }
      nextTime += q; step++;
    }
  }
  function start() {
    if (!S.music || !theme || playing || !unlocked || document.hidden) return;
    if (!ensure()) return;
    playing = true; step = 0; nextTime = ctx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 1.2);
    timer = setInterval(schedule, 25);
    schedule();
  }
  function stop() {
    if (!playing) return;
    playing = false; clearInterval(timer);
    if (ctx) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); }
  }

  /* ---------- effects ---------- */
  const FX = {
    click: t => tone(880, t, 0.03, { type: 'triangle', gain: 0.08, dest: sfxBus, release: 0.03 }),
    place: t => tone(hz(76), t, 0.07, { type: 'triangle', gain: 0.14, dest: sfxBus, release: 0.12 }),
    error: t => { tone(hz(58), t, 0.12, { type: 'square', gain: 0.06, dest: sfxBus, lp: 1200 }); tone(hz(57), t + 0.08, 0.14, { type: 'square', gain: 0.06, dest: sfxBus, lp: 1200 }); },
    eat: t => tone(660, t, 0.07, { type: 'square', gain: 0.07, slide: 1320, dest: sfxBus, release: 0.05, lp: 4000 }),
    die: t => tone(330, t, 0.5, { type: 'sawtooth', gain: 0.09, slide: 60, dest: sfxBus, release: 0.2, lp: 1500 }),
    move: t => noise(t, 0.05, { filter: 'bandpass', freq: 900, q: 0.6, gain: 0.05, dest: sfxBus }),
    merge: (t, v) => tone(hz(60 + Math.min(24, Math.log2(v || 4) * 2)), t, 0.09, { type: 'triangle', gain: 0.13, dest: sfxBus, release: 0.1 }),
    reveal: t => tone(hz(84), t, 0.025, { type: 'sine', gain: 0.06, dest: sfxBus, release: 0.04 }),
    flag: t => { tone(hz(79), t, 0.05, { type: 'triangle', gain: 0.1, dest: sfxBus }); tone(hz(86), t + 0.06, 0.06, { type: 'triangle', gain: 0.1, dest: sfxBus }); },
    boom: t => { noise(t, 0.8, { filter: 'lowpass', freq: 600, gain: 0.5, dest: sfxBus }); tone(90, t, 0.5, { slide: 30, gain: 0.5, dest: sfxBus, release: 0.3 }); },
    tick: t => tone(2200, t, 0.012, { type: 'square', gain: 0.05, dest: sfxBus, release: 0.015, lp: 5000 }),
    win: t => [72, 76, 79, 84].forEach((m, k) => tone(hz(m), t + k * 0.1, 0.18, { type: 'triangle', gain: 0.12, dest: sfxBus, release: 0.25 })),
    fanfare: t => { [67, 72, 76, 79].forEach((m, k) => tone(hz(m), t + k * 0.09, 0.12, { type: 'square', gain: 0.05, dest: sfxBus, lp: 3000 })); [72, 76, 79, 84].forEach(m => tone(hz(m), t + 0.4, 0.7, { type: 'triangle', gain: 0.07, dest: sfxBus, release: 0.5 })); }
  };
  function sfx(name, arg, at) {
    if (!S.sfx || !FX[name] || !unlocked) return;
    if (!ensure()) return;
    FX[name](at != null ? ctx.currentTime + at : ctx.currentTime + 0.005, arg);
  }

  /* ---------- settings panel ---------- */
  function panel() {
    const head = document.querySelector('.game-head .crumbs') || document.querySelector('.page-head h1');
    if (!head || document.getElementById('sound-settings')) return;
    const d = document.createElement('details'); d.className = 'sound-settings'; d.id = 'sound-settings';
    const sum = document.createElement('summary'); sum.setAttribute('aria-label', 'Sound settings');
    const label = () => { sum.textContent = S.music || S.sfx ? '♪ Sound on' : '♪ Sound off'; };
    label();
    const box = document.createElement('div'); box.className = 'sound-box';
    const row = (text, key) => {
      const l = document.createElement('label'); l.className = 'sound-row';
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!S[key];
      c.addEventListener('change', () => {
        S[key] = c.checked; persist(); label(); unlocked = true;
        if (key === 'music') { if (S.music) start(); else stop(); }
        if (key === 'sfx' && S.sfx) sfx('click');
      });
      l.append(c, document.createTextNode(text)); box.append(l);
    };
    row('Music', 'music'); row('Sound effects', 'sfx');
    const v = document.createElement('label'); v.className = 'sound-row sound-vol';
    v.append(document.createTextNode('Volume'));
    const r = document.createElement('input'); r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.05'; r.value = S.volume;
    r.addEventListener('input', () => { S.volume = +r.value; persist(); if (master) master.gain.setTargetAtTime(S.volume, ctx.currentTime, 0.05); });
    v.append(r); box.append(v);
    const note = document.createElement('p'); note.className = 'sound-note';
    note.textContent = 'The music is generated live in your browser for each game. It starts after your first tap or key press.';
    box.append(note);
    d.append(sum, box);
    if (head.tagName === 'P') { head.classList.add('crumbs-row'); head.append(d); } else head.insertAdjacentElement('afterend', d);
    document.addEventListener('click', e => { if (d.open && !d.contains(e.target)) d.open = false; });
  }

  function init(name) {
    themeName = name; theme = THEMES[name] || null;
    const go = () => { unlocked = true; start(); };
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, function once(e) {
      if (e.target.closest && e.target.closest('#sound-settings')) return;
      document.removeEventListener(ev, once, true); go();
    }, true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel); else panel();
  }
  // lets a game speed the music up or down (snake gets faster as it grows)
  function tempo(bpm) { if (theme) theme.bpm = bpm; }

  let errors = 0;
  return { init, sfx, start, stop, tempo, settings: () => Object.assign({}, S), status: () => ({ state: ctx ? ctx.state : 'none', playing, step, theme: themeName, errors }) };
})();
