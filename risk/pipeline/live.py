"""Monthly live run: new forecasts, scores for old forecasts, and the low-risk portfolio.

Run after fetch.py. Reads prices from DATA (default risk-data/) and writes JSON to
LIVE (default risk/live/):
  forecasts/YYYY-MM.json  official forecasts made at the last trading day of a month
  preview.json            forecasts from a mid-month run (never scored, never in the track record)
  scorecard.json          every official forecast month whose outcome is known, scored
  portfolio.json          the live low-risk portfolio against OSEBX
  latest.json             what the web page shows
Old forecast files are never changed, so the track record cannot be rewritten.
"""
import datetime as dt
import glob
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import features as F  # noqa: E402
import model as M  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('DATA', 'risk-data')
LIVE = os.environ.get('LIVE', os.path.join(HERE, '..', 'live'))
FALL_MODEL = 'VolLogit'     # chosen from the walk-forward test (see risk/results)
K = 10                      # stocks in the low-risk portfolio
os.makedirs(os.path.join(LIVE, 'forecasts'), exist_ok=True)


def names():
    u = pd.read_csv(os.path.join(HERE, 'universe.csv'))
    out = {}
    for _, r in u.iterrows():
        for c in r['candidates'].split('|'):
            out[c] = r['name']
    return out


def crosscheck():
    """Compare Yahoo closes with Euronext's own closes for the stocks fetched from both."""
    import io
    prices = pd.read_csv(os.path.join(DATA, 'prices.csv.gz'), parse_dates=['date'])
    out = {}
    for f in sorted(glob.glob(os.path.join(DATA, 'euronext_*.csv'))):
        mn = os.path.basename(f)[9:-4]
        try:
            lines = open(f, encoding='utf-8-sig').read().splitlines()
            i = next(k for k, ln in enumerate(lines) if ln.startswith('Date;'))
            e = pd.read_csv(io.StringIO('\n'.join(lines[i:])), sep=';')
            e = e.set_index(pd.to_datetime(e['Date'], format='%d/%m/%Y'))['Close'].astype(float)
            y = prices[prices['ticker'] == mn].set_index('date')['close']
            j = pd.concat([y.rename('y'), e.rename('e')], axis=1, join='inner').dropna()
            rel = (j['y'] / j['e'] - 1).abs()
            out[mn] = {'days': int(len(j)), 'days_diff_over_1pct': int((rel > 0.01).sum()), 'max_abs_diff_pct': r4(rel.max() * 100)}
        except Exception as ex:  # noqa: BLE001
            out[mn] = {'error': str(ex)[:120]}
    return out


def r4(x):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), 4)


def main():
    prices = pd.read_csv(os.path.join(DATA, 'prices.csv.gz'), parse_dates=['date'])
    macro = pd.read_csv(os.path.join(DATA, 'macro.csv'), parse_dates=['date'], index_col='date')
    panel, notes = F.build(prices, macro)
    d, X = M.prepare(panel)
    as_of = d['date'].max()
    month = as_of.to_period('M')
    today = pd.Timestamp(dt.date.today())
    official = today.to_period('M') > month          # the month is over, so as_of is its last trading day
    now = d[d['date'] == as_of]
    known = d[d['rv_next'].notna() & d['fall_next'].notna() & (d['month'] <= month - 2)]
    mod = M.Models().fit(known, X)
    pr = mod.predict(now, X)
    nm, sec = names(), M.SECTORS
    sig = np.exp(pr['vol_ML'])
    rows = []
    for i, r in now.iterrows():
        rows.append({'ticker': r['ticker'], 'name': nm.get(r['ticker'], r['ticker']), 'sector': sec.get(r['ticker'], 'Other'),
                     'vol_ml': r4(sig[i]), 'vol_har': r4(np.exp(pr.at[i, 'vol_HAR'])), 'vol_now': r4(r['rv_m']),
                     'fall_prob': r4(pr.at[i, f'fall_{FALL_MODEL}']), 'var95_1m': r4(pr.at[i, 'var_q05'] * sig[i] * np.sqrt(21 / 252)),
                     'close': r4(np.exp(r['log_price']))})
    rows.sort(key=lambda x: x['vol_ml'])
    picks = [x['ticker'] for x in rows[:K]]
    fc = {'as_of': str(as_of.date()), 'month': str(month), 'official': bool(official), 'made_utc': dt.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
          'fall_model': FALL_MODEL, 'fall_threshold': 0.15, 'horizon_days': F.H, 'base_rate': r4(mod.base_rate),
          'train_rows': mod.params['train_rows'], 'train_last_month': mod.params['train_last_month'], 'portfolio': picks, 'stocks': rows}
    if official:
        path = os.path.join(LIVE, 'forecasts', f'{month}.json')
        if not os.path.exists(path):                    # never overwrite an official forecast
            json.dump(fc, open(path, 'w'), indent=1)
        prev = os.path.join(LIVE, 'preview.json')
        if os.path.exists(prev):
            os.remove(prev)
    else:
        json.dump(fc, open(os.path.join(LIVE, 'preview.json'), 'w'), indent=1)

    # ---- score every official forecast whose outcome is known ----
    full = panel.set_index(['date', 'ticker'])
    score, port = [], []
    osebx = macro['osebx'].dropna()
    px = prices.pivot_table(index='date', columns='ticker', values='adj_close').sort_index()
    for path in sorted(glob.glob(os.path.join(LIVE, 'forecasts', '*.json'))):
        f = json.load(open(path))
        a = pd.Timestamp(f['as_of'])
        res = []
        for s in f['stocks']:
            key = (a, s['ticker'])
            if key not in full.index:
                continue
            o = full.loc[key]
            if pd.isna(o['rv_next']):
                continue
            res.append({'ticker': s['ticker'], 'vol_ml': s['vol_ml'], 'vol_har': s['vol_har'], 'vol_real': r4(o['rv_next']),
                        'fall_prob': s['fall_prob'], 'fell': int(o['fall_next']), 'ret_1m': r4(o['ret_next']),
                        'var_hit': int(o['ret_next'] < s['var95_1m'])})
        if res:
            t = pd.DataFrame(res)
            e_ml = (np.log(t['vol_real']) - np.log(t['vol_ml'])) ** 2
            e_har = (np.log(t['vol_real']) - np.log(t['vol_har'])) ** 2
            score.append({'month': f['month'], 'as_of': f['as_of'], 'n': len(t), 'mse_ml': r4(e_ml.mean()), 'mse_har': r4(e_har.mean()),
                          'ml_better_share': r4((e_ml < e_har).mean()), 'falls': int(t['fell'].sum()), 'expected_falls': r4(t['fall_prob'].sum()),
                          'var_hits': int(t['var_hit'].sum()), 'expected_var_hits': r4(0.05 * len(t)), 'stocks': res})
        # portfolio return from this month end to the next month end
        nxt = px.index[(px.index > a)]
        ends = pd.Series(nxt, index=nxt).groupby(nxt.to_period('M')).max()
        if len(ends) and ends.index[0] == a.to_period('M') + 1 and today.to_period('M') > ends.index[0]:
            e = ends.iloc[0]
            rr = (px.loc[e, f['portfolio']] / px.loc[a, f['portfolio']] - 1).dropna()
            ob = osebx[:e].iloc[-1] / osebx[:a].iloc[-1] - 1 if len(osebx[:a]) else np.nan
            port.append({'formed': f['as_of'], 'held_to': str(e.date()), 'picks': f['portfolio'], 'ret': r4(rr.mean()), 'osebx': r4(ob)})
    w, wb = 1.0, 1.0
    for p in port:
        w *= 1 + (p['ret'] or 0)
        wb *= 1 + (p['osebx'] or 0)
        p['cum'], p['cum_osebx'] = r4(w - 1), r4(wb - 1)
    json.dump({'updated': fc['made_utc'], 'months': score}, open(os.path.join(LIVE, 'scorecard.json'), 'w'), indent=1)
    json.dump({'updated': fc['made_utc'], 'k': K, 'months': port}, open(os.path.join(LIVE, 'portfolio.json'), 'w'), indent=1)
    latest = {k: fc[k] for k in fc if k != 'stocks'}
    latest.update({'stocks': rows, 'scored_months': len(score), 'portfolio_months': len(port),
                   'track': [{k: s[k] for k in s if k != 'stocks'} for s in score], 'portfolio_track': port,
                   'data_notes': notes, 'crosscheck_euronext': crosscheck()})
    json.dump(latest, open(os.path.join(LIVE, 'latest.json'), 'w'), indent=1)
    print(json.dumps({'as_of': fc['as_of'], 'official': official, 'stocks': len(rows), 'scored': len(score), 'portfolio_months': len(port)}))


if __name__ == '__main__':
    main()
