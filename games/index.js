(function () {
  'use strict';
  const t = k => { const v = Games.load(k, null); return v ? Games.time(v) : null; };
  const lines = {
    sudoku: () => ['easy', 'medium', 'hard'].map(l => (t('sudoku-best-' + l) ? `${l[0].toUpperCase() + l.slice(1)} ${t('sudoku-best-' + l)}` : null)).filter(Boolean).join(' · '),
    snake: () => { const a = Games.load('snake-best-walls', 0), b = Games.load('snake-best-wrap', 0); return a || b ? `Best ${Math.max(a, b)}` : ''; },
    2048: () => { const b = Games.load('2048-best', 0); return b ? `Best ${b}` : ''; },
    mines: () => ['easy', 'medium', 'hard'].map(l => (t('mines-best-' + l) ? `${l[0].toUpperCase() + l.slice(1)} ${t('mines-best-' + l)}` : null)).filter(Boolean).join(' · ')
  };
  document.querySelectorAll('[data-best]').forEach(el => { el.textContent = lines[el.dataset.best]() || ''; });
})();
