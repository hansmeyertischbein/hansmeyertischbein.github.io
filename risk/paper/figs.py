import json, numpy as np, pandas as pd, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
for f in ['texgyreheros-regular.otf', 'texgyreheros-bold.otf']:
    fm.fontManager.addfont('/usr/share/texmf/fonts/opentype/public/tex-gyre/' + f)
plt.rcParams.update({'font.family': 'TeX Gyre Heros', 'font.size': 8.5, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.edgecolor': '#8a93a6', 'axes.labelcolor': '#1A2238', 'xtick.color': '#5B6478', 'ytick.color': '#5B6478',
                     'axes.grid': True, 'grid.color': '#E6EAF0', 'grid.linewidth': 0.6, 'axes.axisbelow': True, 'legend.frameon': False,
                     'pdf.fonttype': 42})
C1, C2, C3, G, INK = '#2a78d6', '#eb6834', '#1baf7a', '#8a93a6', '#1A2238'
B = json.load(open('live/risk/results/backtest.json'))
W = 6.3

# Fig 1: yearly error change vs HAR
yrs = [r for r in B['by_period'] if r['period'].isdigit()]
ch = [(r['mse_ML'] / r['mse_HAR'] - 1) * 100 for r in yrs]
fig, ax = plt.subplots(figsize=(W, 2.3))
ax.bar([r['period'] for r in yrs], ch, color=[C1 if c < 0 else C2 for c in ch], width=0.62)
ax.axhline(0, color=G, lw=0.8)
ax.set_ylabel('Change in MSE vs HAR (%)')
for i, c in enumerate(ch):
    ax.text(i, c + (0.8 if c > 0 else -0.8), f'{c:+.0f}', ha='center', va='bottom' if c > 0 else 'top', fontsize=7, color=INK)
ax.set_ylim(min(ch) - 4, max(ch) + 4); ax.grid(axis='x', visible=False)
fig.tight_layout(); fig.savefig('paper/fig_years.pdf'); plt.close(fig)

# Fig 2: calibration
fig, ax = plt.subplots(figsize=(W * 0.62, 2.6))
for m, col, lab in (('VolLogit', C2, 'Two-step model'), ('Logit', G, 'Logistic reference')):
    c = B['calibration'][m]
    ax.plot([x['pred'] * 100 for x in c], [x['actual'] * 100 for x in c], 'o-', color=col, ms=3.5, lw=1.5, label=lab)
mx = 35
ax.plot([0, mx], [0, mx], ls='--', color=INK, lw=0.8, label='Perfect calibration')
ax.set_xlim(0, mx); ax.set_ylim(0, mx); ax.set_xlabel('Forecast probability, decile mean (%)'); ax.set_ylabel('Actual share that fell (%)')
ax.legend(loc='upper left', fontsize=7.5)
fig.tight_layout(); fig.savefig('paper/fig_cal.pdf'); plt.close(fig)

# Fig 3: importance
fig, axs = plt.subplots(1, 2, figsize=(W, 2.9))
for ax, t, col, title in ((axs[0], 'vol', C1, 'Volatility'), (axs[1], 'fall', C2, 'Large falls')):
    L = B['importance'][t][:10][::-1]
    ax.barh([x['label'] for x in L], [x['share'] * 100 for x in L], color=col, height=0.62)
    ax.set_title(title, fontsize=9, color=INK, loc='left'); ax.set_xlabel('Share of mean |SHAP| (%)'); ax.grid(axis='y', visible=False)
    ax.tick_params(axis='y', labelsize=7.2)
fig.tight_layout(); fig.savefig('paper/fig_imp.pdf'); plt.close(fig)

# Fig 4: wealth
Wl = pd.DataFrame(B['portfolio']['wealth'])
x = pd.PeriodIndex(Wl['month'], freq='M').to_timestamp()
fig, ax = plt.subplots(figsize=(W, 2.7))
for k, col, ls, lab in (('low_ML', C1, '-', 'Low risk (ML)'), ('low_HAR', C1, '--', 'Low risk (HAR)'), ('osebx', INK, '-', 'OSEBX'), ('high_ML', C2, '-', 'High risk (ML)')):
    ax.plot(x, Wl[k], color=col, ls=ls, lw=1.3, label=lab)
ax.set_ylabel('Value of NOK 1'); ax.legend(ncol=4, fontsize=7.5, loc='upper left')
fig.tight_layout(); fig.savefig('paper/fig_pf.pdf'); plt.close(fig)

# Fig 5: forecast vs realised for one stock (Equinor)
s = B['stocks']['EQNR']
x = pd.PeriodIndex(s['month'], freq='M').to_timestamp()
fig, ax = plt.subplots(figsize=(W, 2.3))
ax.plot(x, np.array(s['real']) * 100, color=G, lw=1.1, label='Realised')
ax.plot(x, np.array(s['ml']) * 100, color=C1, lw=1.3, label='ML forecast')
ax.plot(x, np.array(s['har']) * 100, color=C2, lw=1.0, ls='--', label='HAR forecast')
ax.set_ylabel('Annualised volatility (%)'); ax.legend(ncol=3, fontsize=7.5, loc='upper right')
fig.tight_layout(); fig.savefig('paper/fig_eqnr.pdf'); plt.close(fig)
print('figures done')
