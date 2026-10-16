"""Daily reversal on Oslo Børs: buy yesterday's biggest loser, short yesterday's biggest winner.

  python reversal/reversal.py DATA_DIR      (DATA_DIR = the risk-data branch: prices.csv.gz, macro.csv)

Signal on day t: close-to-close return (adjusted for dividends and splits) of each eligible stock.
Entry at the open on day t+1, half the money long the loser and half short the winner.
Three exits: (1) close on day t+1, (2) open on day t+2, (3) close five trading days after the entry day.
Eligible: in the OSEBX list used by the risk project, traded on day t and t+1, share price of at least
NOK 1, and median daily turnover of at least NOK 5 million over the previous 63 trading days.
Writes reversal/trades.json; the page applies trading costs and compounds the returns.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

DATA = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
START, END = '2021-01-01', '2025-12-31'
HOLD = 5

p = pd.read_csv(os.path.join(DATA, 'prices.csv.gz'), parse_dates=['date'])
p = p[(p['date'] >= '2020-01-01') & (p['volume'] > 0)].sort_values(['ticker', 'date'])
f = p['adj_close'] / p['close']                    # dividend and split adjustment, applied to the open as well
p['ao'], p['ac'] = p['open'] * f, p['adj_close']
p['turn'] = p['close'] * p['volume']
p['med_turn'] = p.groupby('ticker')['turn'].transform(lambda s: s.shift(1).rolling(63, min_periods=40).median())
p['ret'] = p.groupby('ticker')['ac'].pct_change()
O = p.pivot(index='date', columns='ticker', values='ao')
C = p.pivot(index='date', columns='ticker', values='ac')
R = p.pivot(index='date', columns='ticker', values='ret')
ok = (p.pivot(index='date', columns='ticker', values='med_turn') >= 5e6) & (p.pivot(index='date', columns='ticker', values='close') >= 1)
dates = C.index
names = {}
u = pd.read_csv(os.path.join(HERE, '..', 'risk', 'pipeline', 'universe.csv'))
for _, r in u.iterrows():
    for c in r['candidates'].split('|'):
        names[c] = r['name']

trades = []
for i, t in enumerate(dates[:-HOLD - 2]):
    if not (START <= str(t.date()) <= END):
        continue
    d1, d2, d6 = dates[i + 1], dates[i + 2], dates[i + 1 + HOLD]
    elig = ok.loc[t] & R.loc[t].notna() & O.loc[d1].notna() & C.loc[d1].notna()
    r = R.loc[t][elig]
    if len(r) < 10:
        continue
    lo, hi = r.idxmin(), r.idxmax()

    def leg(tk):
        e = O.at[d1, tk]
        x2 = O.at[d2, tk] if pd.notna(O.at[d2, tk]) else C.at[d1, tk]       # not traded at the next open: use the entry day's close
        x3 = C.loc[d1:d6, tk].dropna()
        return C.at[d1, tk] / e - 1, x2 / e - 1, x3.iloc[-1] / e - 1
    L, S = leg(lo), leg(hi)
    trades.append({'d': str(t.date()), 'n': int(len(r)), 'L': lo, 'Lr': round(float(r[lo]), 4), 'S': hi, 'Sr': round(float(r[hi]), 4),
                   'l': [round(float(x), 5) for x in L], 's': [round(float(x), 5) for x in S]})

m = pd.read_csv(os.path.join(DATA, 'macro.csv'), parse_dates=['date'], index_col='date')['osebx'].dropna()
ob = m[(m.index >= pd.Timestamp(START) - pd.Timedelta(days=7)) & (m.index <= END)]
base = ob[ob.index < START].iloc[-1]
ob = ob[ob.index >= START]
osebx = [{'d': str(d.date()), 'v': round(float(v / base), 5)} for d, v in ob.items()]
out = {'start': START, 'end': END, 'hold_days': HOLD, 'n_trades': len(trades), 'stocks': sorted(set(t['L'] for t in trades) | set(t['S'] for t in trades)),
       'names': names, 'trades': trades, 'osebx': osebx, 'avg_eligible': round(float(np.mean([t['n'] for t in trades])), 1)}
json.dump(out, open(os.path.join(HERE, 'trades.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(trades), 'trades; eligible per day', out['avg_eligible'])
