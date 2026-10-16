"""Short yesterday's big winners on Oslo Børs.

  python reversal/reversal.py DATA_DIR      (DATA_DIR = the risk-data branch: prices.csv.gz, macro.csv)

Day 0: a stock rises at least the threshold (5% on the page; every candidate from 3% up is stored so the
page can change it). Day 1: short it at the open and buy it back at the close. The money is split equally
between the day's shorts; on days without a signal there is no trade.
Eligible stocks: in the OSEBX list used by the risk project, traded on day 0 and day 1, share price of at
least NOK 1, and median daily turnover of at least NOK 5 million over the previous 63 trading days.
Returns use prices adjusted for dividends and splits. Writes reversal/trades.json.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

DATA = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
START, END = '2021-01-01', '2025-12-31'
MIN_STORE = 0.03

p = pd.read_csv(os.path.join(DATA, 'prices.csv.gz'), parse_dates=['date'])
p = p[(p['date'] >= '2020-01-01') & (p['volume'] > 0)].sort_values(['ticker', 'date'])
f = p['adj_close'] / p['close']
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

days = []
for i, t in enumerate(dates[:-1]):
    if not (START <= str(t.date()) <= END):
        continue
    d1 = dates[i + 1]
    elig = ok.loc[t] & R.loc[t].notna() & O.loc[d1].notna() & C.loc[d1].notna()
    r = R.loc[t][elig]
    if len(r) < 10:
        continue
    intraday = (C.loc[d1, r.index] / O.loc[d1, r.index] - 1)
    cand = r[r >= MIN_STORE].sort_values(ascending=False)
    days.append({'d': str(t.date()), 'e': str(d1.date()), 'n': int(len(r)), 'm': round(float(intraday.mean()), 5),
                 'c': [[tk, round(float(r[tk]), 4), round(float(intraday[tk]), 5)] for tk in cand.index]})

m = pd.read_csv(os.path.join(DATA, 'macro.csv'), parse_dates=['date'], index_col='date')['osebx'].dropna()
ob = m[(m.index >= pd.Timestamp(START) - pd.Timedelta(days=7)) & (m.index <= END)]
base = ob[ob.index < START].iloc[-1]
ob = ob[ob.index >= START]
out = {'start': START, 'end': END, 'min_stored': MIN_STORE, 'n_days': len(days), 'names': names, 'days': days,
       'osebx': [{'d': str(d.date()), 'v': round(float(v / base), 5)} for d, v in ob.items()],
       'avg_eligible': round(float(np.mean([x['n'] for x in days])), 1)}
json.dump(out, open(os.path.join(HERE, 'trades.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
n5 = [x for x in days if any(c[1] >= 0.05 for c in x['c'])]
print(len(days), 'days;', len(n5), 'with a 5% signal')
