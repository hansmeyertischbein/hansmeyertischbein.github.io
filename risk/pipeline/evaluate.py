"""Out-of-sample evaluation of the walk-forward forecasts."""
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

VOL_MODELS = ['EWMA', 'HAR', 'LightGBM', 'RandomForest', 'MLP', 'ML']
FALL_MODELS = ['Logit', 'LightGBM', 'RandomForest', 'MLP', 'ML']
CRISES = {'Covid crash (Feb–May 2020)': ('2020-02', '2020-05'), '2022 energy and rates shock': ('2022-01', '2022-12')}


def newey_west_t(x, lags=3):
    """t-statistic of the mean of x with Newey–West standard errors."""
    x = np.asarray(x, float)
    x = x[~np.isnan(x)]
    n = len(x)
    u = x - x.mean()
    s = (u @ u) / n
    for L in range(1, lags + 1):
        w = 1 - L / (lags + 1)
        s += 2 * w * (u[L:] @ u[:-L]) / n
    se = np.sqrt(s / n)
    t = x.mean() / se
    return float(t), float(2 * (1 - stats.t.cdf(abs(t), n - 1))), n


def vol_losses(p, m):
    y = p['y_vol']
    f = p[f'vol_{m}']
    var_t = np.exp(2 * y)
    var_f = np.exp(2 * f) * p[f'scale_{m}']
    return pd.DataFrame({'mse_log': (y - f) ** 2, 'qlike': var_t / var_f - np.log(var_t / var_f) - 1, 'month': p['month']})


def vol_table(p):
    p = p[p['rv_next'].notna()]
    rows, base = [], vol_losses(p, 'HAR')
    sst = ((p['y_vol'] - p['y_vol'].mean()) ** 2).sum()
    for m in VOL_MODELS:
        L = vol_losses(p, m)
        r = {'model': m, 'mse_log': L['mse_log'].mean(), 'qlike': L['qlike'].mean(),
             'r2_oos': 1 - L['mse_log'].sum() / sst,
             'r2_vs_har': 1 - L['mse_log'].sum() / base['mse_log'].sum(),
             'rank_corr': p.groupby('month').apply(lambda g: stats.spearmanr(g[f'vol_{m}'], g['y_vol'])[0] if len(g) > 4 else np.nan).mean()}
        if m != 'HAR':
            for k in ('mse_log', 'qlike'):
                diff = (L.groupby('month')[k].mean() - base.groupby('month')[k].mean())
                t, pv, n = newey_west_t(diff.values)
                r[f'dm_t_{k}'], r[f'dm_p_{k}'] = t, pv
        rows.append(r)
    return pd.DataFrame(rows)


def fall_table(p):
    p = p[p['fall_next'].notna()]
    y = p['fall_next'].values
    rows = []
    clim = brier_score_loss(y, p['base_rate'])
    ref = p['fall_Logit'].values
    for m in FALL_MODELS:
        q = p[f'fall_{m}'].clip(1e-4, 1 - 1e-4).values
        top = p.assign(q=q).groupby('month', group_keys=False).apply(lambda g: g.nlargest(max(1, len(g) // 10), 'q'))
        r = {'model': m, 'auc': roc_auc_score(y, q), 'brier': brier_score_loss(y, q), 'brier_skill': 1 - brier_score_loss(y, q) / clim,
             'log_loss': log_loss(y, q), 'hit_rate_top10': top['fall_next'].mean(), 'base_rate': y.mean()}
        if m != 'Logit':
            d = pd.DataFrame({'month': p['month'], 'd': (q - y) ** 2 - (ref - y) ** 2}).groupby('month')['d'].mean()
            r['dm_t_brier'], r['dm_p_brier'], _ = newey_west_t(d.values)
        rows.append(r)
    return pd.DataFrame(rows)


def calibration(p, m, bins=10):
    p = p[p['fall_next'].notna()]
    q = p[f'fall_{m}']
    b = pd.qcut(q.rank(method='first'), bins, labels=False)
    return p.assign(q=q, b=b).groupby('b').agg(pred=('q', 'mean'), actual=('fall_next', 'mean'), n=('q', 'size')).reset_index(drop=True)


def by_period(p, m_vol=('HAR', 'ML'), m_fall=('Logit', 'ML')):
    p = p[p['rv_next'].notna()]
    out = []
    groups = [('All test months', p)] + [(k, p[(p['month'] >= pd.Period(a, 'M')) & (p['month'] <= pd.Period(b, 'M'))]) for k, (a, b) in CRISES.items()]
    groups += [(str(y), g) for y, g in p.groupby(p['date'].dt.year)]
    for name, g in groups:
        r = {'period': name, 'n': len(g)}
        for m in m_vol:
            r[f'mse_{m}'] = vol_losses(g, m)['mse_log'].mean()
        for m in m_fall:
            gg = g[g['fall_next'].notna()]
            r[f'auc_{m}'] = roc_auc_score(gg['fall_next'], gg[f'fall_{m}']) if gg['fall_next'].nunique() == 2 else np.nan
        r['fall_rate'] = g['fall_next'].mean()
        out.append(r)
    return pd.DataFrame(out)


def var_backtest(p, m='ML', qcol='var_q05', level=0.05):
    """Monthly 5% VaR per stock from the volatility forecast; Kupiec's test of the exceedance rate."""
    p = p[p['ret_next'].notna()]
    sig = np.exp(p[f'vol_{m}']) * np.sqrt(21 / 252)
    var = p[qcol] * sig
    hit = (p['ret_next'] < var).astype(int)
    n, x = len(hit), int(hit.sum())
    pi = x / n
    lr = -2 * ((n - x) * np.log(1 - level) + x * np.log(level) - ((n - x) * np.log(1 - pi) + x * np.log(pi)))
    by_m = hit.groupby(p['month']).mean()
    return {'model': m, 'n': n, 'exceedances': x, 'rate': pi, 'expected': level, 'kupiec_lr': float(lr), 'kupiec_p': float(1 - stats.chi2.cdf(lr, 1)),
            'months_over_20pct': int((by_m > 0.2).sum()), 'months': int(len(by_m))}


def low_risk_portfolio(p, m='vol_ML', k=10, cost=0.002):
    """Each month end, hold the k stocks with the lowest forecast volatility, equally weighted, for one month."""
    p = p[p['ret_next'].notna()].copy()
    p['simple'] = np.exp(p['ret_next']) - 1
    rows, prev = [], set()
    for mo, g in p.groupby('month'):
        pick = g.nsmallest(k, m)
        names = set(pick['ticker'])
        turn = 1 - len(names & prev) / k if prev else 1.0
        prev = names
        hi = g.nlargest(k, m)
        rows.append({'month': mo, 'low': pick['simple'].mean() - 2 * cost * turn, 'low_gross': pick['simple'].mean(), 'high': hi['simple'].mean(),
                     'all': g['simple'].mean(), 'turnover': turn, 'n_universe': len(g),
                     'pred_vol_low': float(np.exp(pick[m]).mean()), 'real_vol_low': float(pick['rv_next'].mean())})
    return pd.DataFrame(rows)


def perf(r, rf=None):
    r = pd.Series(r).dropna()
    ann_ret = (1 + r).prod() ** (12 / len(r)) - 1
    vol = r.std() * np.sqrt(12)
    ex = r - (rf.reindex(r.index).fillna(0) if rf is not None else 0)
    sharpe = ex.mean() / r.std() * np.sqrt(12)
    wealth = (1 + r).cumprod()
    mdd = (wealth / wealth.cummax() - 1).min()
    return {'ann_return': ann_ret, 'ann_vol': vol, 'sharpe': sharpe, 'max_drawdown': mdd}
