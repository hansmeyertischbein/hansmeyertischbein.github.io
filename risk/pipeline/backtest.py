"""Run the walk-forward test and write the results the web page and the paper use.

  python risk/pipeline/backtest.py DATA_DIR [CACHE_DIR]

DATA_DIR holds prices.csv.gz and macro.csv (the risk-data branch). With CACHE_DIR,
walk-forward predictions already saved there as pred_{10,15,20}.pkl are reused.
Writes risk/results/backtest.json.
"""
import json
import os
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import evaluate as E  # noqa: E402
import features as F  # noqa: E402
import model as M  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'results')

LABELS = {
    'rv_d': 'Latest day’s move', 'rv_w': 'Volatility, last week', 'rv_m': 'Volatility, last month', 'rv_q': 'Volatility, last quarter',
    'rv_y': 'Volatility, last year', 'ewma': 'EWMA volatility', 'semi_m': 'Downside volatility, last month', 'park_m': 'Intraday range, last month',
    'skew_q': 'Skewness, last quarter', 'kurt_q': 'Fat tails, last quarter', 'ret_m': 'Return, last month', 'ret_y': 'Return, last year',
    'dd_y': 'Fall from 52-week high', 'min_ret_q': 'Worst day, last quarter', 'beta': 'Beta to the market', 'idio_q': 'Stock-specific volatility',
    'log_turn': 'Turnover', 'amihud': 'Illiquidity (Amihud)', 'zero_ret': 'Days without price change', 'log_price': 'Share price level',
    'mkt_rv_m': 'Market volatility, last month', 'mkt_rv_q': 'Market volatility, last quarter', 'mkt_ret_m': 'Market return, last month',
    'vix': 'VIX level', 'vix_chg': 'VIX change, last month', 'brent_ret': 'Oil price change, last month', 'brent_rv': 'Oil price volatility',
    'nok_ret': 'NOK change against USD', 'nok_rv': 'NOK volatility', 'policy_rate': 'Norges Bank policy rate', 'rate_chg': 'Policy rate change, last quarter',
    'moy': 'Month of the year'}


def r(x, n=4):
    if x is None:
        return None
    x = float(x)
    return None if not np.isfinite(x) else round(x, n)


def records(df, n=4):
    return [{k: (r(v, n) if isinstance(v, (float, np.floating, int, np.integer)) and not isinstance(v, bool) else str(v)) for k, v in row.items()}
            for row in df.to_dict('records')]


def auc_boot(p, a, b, n=2000, seed=1):
    """Month-block bootstrap of the AUC difference between models a and b."""
    p = p[p['fall_next'].notna()]
    rng = np.random.default_rng(seed)
    months = p['month'].unique()
    groups = {m: g for m, g in p.groupby('month')}
    diffs = []
    for _ in range(n):
        s = pd.concat([groups[m] for m in rng.choice(months, len(months))])
        if s['fall_next'].nunique() < 2:
            continue
        diffs.append(roc_auc_score(s['fall_next'], s[f'fall_{a}']) - roc_auc_score(s['fall_next'], s[f'fall_{b}']))
    diffs = np.array(diffs)
    return {'diff': r(roc_auc_score(p['fall_next'], p[f'fall_{a}']) - roc_auc_score(p['fall_next'], p[f'fall_{b}'])),
            'ci_low': r(np.quantile(diffs, 0.025)), 'ci_high': r(np.quantile(diffs, 0.975)), 'share_above_zero': r((diffs > 0).mean())}


def export(preds, contrib, params, panel, macro, notes):
    p = preds['15']
    p = p[p['rv_next'].notna()]
    res = {'test': {'first_month': str(p['month'].min()), 'last_month': str(p['month'].max()), 'months': int(p['month'].nunique()),
                    'rows': int(len(p)), 'stocks': int(p['ticker'].nunique()), 'avg_stocks_per_month': r(p.groupby('month').size().mean(), 1),
                    'fall_rate': r(p['fall_next'].mean())},
           'data': {**notes, 'universe_rule': f'at least {F.MIN_HISTORY} trading days of history, median daily turnover of at least NOK {F.MIN_TURNOVER / 1e6:.0f} million over the last 63 days, and a share price of at least NOK {F.MIN_PRICE:.0f}'},
           'params': params}
    res['vol'] = records(E.vol_table(p))
    res['fall'] = records(E.fall_table(p))
    res['auc_vollogit_vs_logit'] = auc_boot(p, 'VolLogit', 'Logit')
    res['auc_ml_vs_logit'] = auc_boot(p, 'ML', 'Logit')
    res['calibration'] = {m: records(E.calibration(p, m)) for m in ('Logit', 'ML', 'VolLogit')}
    res['by_period'] = records(E.by_period(p, m_vol=('HAR', 'ML'), m_fall=('Logit', 'ML', 'VolLogit')))
    res['var'] = {m: {k: (r(v) if isinstance(v, float) else v) for k, v in E.var_backtest(p, m, q).items()} for m, q in (('ML', 'var_q05'), ('HAR', 'var_q05_har'))}
    # thresholds
    th = []
    for k, q in preds.items():
        q = q[q['fall_next'].notna()]
        t = E.fall_table(q).set_index('model')
        th.append({'threshold': int(k), 'base_rate': r(q['fall_next'].mean()),
                   **{f'auc_{m}': r(t.at[m, 'auc']) for m in ('Logit', 'ML', 'VolLogit')},
                   **{f'brier_skill_{m}': r(t.at[m, 'brier_skill']) for m in ('Logit', 'ML', 'VolLogit')}})
    res['thresholds'] = sorted(th, key=lambda x: x['threshold'])
    # importance (mean absolute SHAP from LightGBM, as a share)
    imp = {}
    for t in ('vol', 'fall'):
        c = contrib[contrib['target'] == t].drop(columns='target').abs().mean()
        sec = c[[k for k in c.index if k.startswith('sec_')]].sum()
        c = c[[k for k in c.index if not k.startswith('sec_')]]
        c['sector'] = sec
        c = (c / c.sum()).sort_values(ascending=False)
        imp[t] = [{'feature': k, 'label': LABELS.get(k, 'Sector' if k == 'sector' else k), 'share': r(v)} for k, v in c.items()]
    res['importance'] = imp
    # low-risk portfolio
    m = macro['osebx'].dropna().resample('ME').last().pct_change()
    m.index = m.index.to_period('M')
    rf = macro['policy_rate'].resample('ME').last() / 100 / 12
    rf.index = rf.index.to_period('M')
    port = {}
    series = {}
    for name, col in (('ML', 'vol_ML'), ('HAR', 'vol_HAR')):
        pf = E.low_risk_portfolio(p, col).set_index('month')
        pf.index = pf.index + 1                      # formed at the end of month t, earned in month t+1
        series[f'low_{name}'] = pf['low']
        if name == 'ML':
            series['high_ML'] = pf['high']
            series['equal_weight'] = pf['all']
            port['turnover_ML'] = r(pf['turnover'].mean())
        else:
            port['turnover_HAR'] = r(pf['turnover'].mean())
    S = pd.DataFrame(series)
    S['osebx'] = m.reindex(S.index)
    S = S.dropna()
    port['stats'] = {k: {kk: r(vv) for kk, vv in E.perf(S[k], rf).items()} for k in S.columns}
    port['first_month'], port['last_month'] = str(S.index.min()), str(S.index.max())
    W = (1 + S).cumprod()
    port['wealth'] = [{'month': str(i), **{k: r(v) for k, v in row.items()}} for i, row in W.iterrows()]
    port['cost_per_trade'] = 0.002
    port['k'] = 10
    res['portfolio'] = port
    # per-stock history for the lookup
    nm = {}
    u = pd.read_csv(os.path.join(HERE, 'universe.csv'))
    for _, row in u.iterrows():
        for c in row['candidates'].split('|'):
            nm[c] = row['name']
    hist = {}
    for t, g in p.sort_values('month').groupby('ticker'):
        hist[t] = {'name': nm.get(t, t), 'sector': M.SECTORS.get(t, 'Other'), 'month': [str(x) for x in g['month']],
                   'ml': [r(np.exp(v), 3) for v in g['vol_ML']], 'har': [r(np.exp(v), 3) for v in g['vol_HAR']],
                   'real': [r(v, 3) for v in g['rv_next']], 'fall_p': [r(v, 3) for v in g['fall_VolLogit']], 'fell': [int(v) for v in g['fall_next']]}
    res['stocks'] = hist
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'backtest.json'), 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    return res


if __name__ == '__main__':
    data = sys.argv[1]
    cache = sys.argv[2] if len(sys.argv) > 2 else None
    prices = pd.read_csv(os.path.join(data, 'prices.csv.gz'), parse_dates=['date'])
    macro = pd.read_csv(os.path.join(data, 'macro.csv'), parse_dates=['date'], index_col='date')
    panel, notes = F.build(prices, macro)
    preds, params, contrib = {}, None, None
    for th in ('15', '10', '20'):
        path = cache and os.path.join(cache, f'pred_{th}.pkl')
        if path and os.path.exists(path):
            preds[th] = pd.read_pickle(path)
            if th == '15':
                contrib = pd.read_pickle(os.path.join(cache, 'contrib_15.pkl'))
                params = json.load(open(os.path.join(cache, 'params_15.json')))
        else:
            pr, pa, co = M.walk_forward(panel, fall_col=f'fall{th}')
            preds[th] = pr
            if th == '15':
                params, contrib = pa, co
    res = export(preds, contrib, params, panel, macro, notes)
    print(json.dumps({k: res[k] for k in ('test', 'auc_vollogit_vs_logit', 'auc_ml_vs_logit', 'thresholds')}, indent=1))
