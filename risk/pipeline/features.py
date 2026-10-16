"""Clean daily prices and build one row per stock and month end: features known at the
month end, and the two targets measured over the next 21 trading days.

Targets
  rv_next   annualised realised volatility over the next 21 trading days
  fall_next 1 if the close falls 15% or more below the month-end close at any point
            in the next 21 trading days, else 0
"""
import numpy as np
import pandas as pd

H = 21                 # forecast horizon in trading days (about one month)
FALL = -0.15           # threshold for a large fall
MIN_HISTORY = 252      # days of history needed before a stock enters
MIN_TURNOVER = 5e6     # median daily turnover in NOK over the last 63 days
MIN_PRICE = 1.0
DATA_START = '2004-01-01'


def clean(p):
    """Returns daily log returns per stock after removing obvious data errors. Logs counts."""
    p = p[p['date'] >= DATA_START].sort_values(['ticker', 'date']).copy()
    notes = {'rows_in': int(len(p))}
    # days without trading (holidays, suspensions) carry no information
    p = p[p['volume'] > 0]
    notes['dropped_zero_volume'] = notes['rows_in'] - int(len(p))
    p['r'] = np.log(p['adj_close']).groupby(p['ticker']).diff()
    # a bad tick: a jump of more than 30% that is reversed the next day
    nxt = p.groupby('ticker')['r'].shift(-1)
    spike = (p['r'].abs() > 0.30) & (nxt.abs() > 0.30) & (np.sign(p['r']) != np.sign(nxt)) & ((p['r'] + nxt).abs() < 0.15)
    notes['dropped_spikes'] = int(spike.sum())
    p = p[~spike]
    p['r'] = np.log(p['adj_close']).groupby(p['ticker']).diff()
    # recorded splits that the adjusted series still shows as a jump
    bad = (p['split'] > 0) & (p['r'].abs() > 0.3)
    notes['dropped_split_jumps'] = int(bad.sum())
    p.loc[bad, 'r'] = np.nan
    p['turnover'] = p['close'] * p['volume']
    p['hl'] = np.log(p['high'] / p['low']).where((p['high'] > 0) & (p['low'] > 0) & (p['high'] >= p['low']))
    return p, notes


def _roll(g, w, f):
    return g.rolling(w, min_periods=int(w * 0.8)).apply(f, raw=True) if callable(f) else getattr(g.rolling(w, min_periods=int(w * 0.8)), f)()


def build(prices, macro):
    p, notes = clean(prices)
    ann = np.sqrt(252)
    # equal-weighted market return across all stocks trading that day (used for beta and market risk)
    mkt = p.groupby('date')['r'].mean().rename('mkt')
    p = p.join(mkt, on='date')
    rows = []
    for t, g in p.groupby('ticker', sort=False):
        g = g.set_index('date')
        r, m = g['r'], g['mkt']
        f = pd.DataFrame(index=g.index)
        for name, w in [('rv_w', 5), ('rv_m', 21), ('rv_q', 63), ('rv_y', 252)]:
            f[name] = np.sqrt((r ** 2).rolling(w, min_periods=max(3, int(w * 0.8))).mean()) * ann
        f['rv_d'] = r.abs() * ann
        f['ewma'] = np.sqrt((r ** 2).ewm(alpha=0.06, min_periods=60).mean()) * ann
        f['semi_m'] = np.sqrt((r.clip(upper=0) ** 2).rolling(21, min_periods=17).mean()) * ann
        f['park_m'] = np.sqrt((g['hl'] ** 2 / (4 * np.log(2))).rolling(21, min_periods=17).mean()) * ann
        f['skew_q'] = r.rolling(63, min_periods=50).skew()
        f['kurt_q'] = r.rolling(63, min_periods=50).kurt()
        f['ret_m'] = r.rolling(21, min_periods=17).sum()
        f['ret_y'] = r.rolling(252, min_periods=200).sum()
        logp = r.fillna(0).cumsum()
        f['dd_y'] = logp - logp.rolling(252, min_periods=200).max()
        f['min_ret_q'] = r.rolling(63, min_periods=50).min()
        cov = r.rolling(252, min_periods=200).cov(m)
        var = m.rolling(252, min_periods=200).var()
        f['beta'] = cov / var
        f['idio_q'] = (r - f['beta'] * m).rolling(63, min_periods=50).std() * ann
        f['log_turn'] = np.log(g['turnover'].rolling(63, min_periods=40).median())
        f['amihud'] = np.log((r.abs() / g['turnover']).rolling(63, min_periods=40).mean() * 1e9 + 1e-12)
        f['zero_ret'] = (r == 0).astype(float).rolling(63, min_periods=40).mean()
        f['log_price'] = np.log(g['close'])
        f['n_hist'] = np.arange(1, len(g) + 1)
        # targets: next 21 trading days
        fwd_sq = (r ** 2)[::-1].rolling(H, min_periods=H).sum()[::-1].shift(-1)
        f['rv_next'] = np.sqrt(fwd_sq / H) * ann
        lp = np.log(g['adj_close'])
        fwd_min = lp[::-1].rolling(H, min_periods=H).min()[::-1].shift(-1)
        f['fall_next'] = ((np.exp(fwd_min - lp) - 1) <= FALL).astype(float).where(fwd_min.notna())
        f['ret_next'] = (lp.shift(-H) - lp)
        f['ticker'] = t
        # keep the last trading day of each calendar month
        me = f.groupby(f.index.to_period('M')).tail(1)
        rows.append(me)
    d = pd.concat(rows).reset_index().rename(columns={'index': 'date'})
    d['month'] = d['date'].dt.to_period('M')

    # market-wide features, known at the month end
    mk = pd.DataFrame({'mkt': mkt})
    mk['mkt_rv_m'] = np.sqrt((mk['mkt'] ** 2).rolling(21, min_periods=17).mean()) * ann
    mk['mkt_rv_q'] = np.sqrt((mk['mkt'] ** 2).rolling(63, min_periods=50).mean()) * ann
    mk['mkt_ret_m'] = mk['mkt'].rolling(21, min_periods=17).sum()
    m = macro.copy()
    m.index = pd.to_datetime(m.index)
    # US closes (VIX, Brent) come after Oslo's close, so use the previous day's value to avoid look-ahead
    m = m.sort_index().ffill().shift(1)
    mk = mk.join(m, how='left').ffill()
    mk['vix_chg'] = np.log(mk['vix']).diff(21)
    mk['brent_ret'] = np.log(mk['brent']).diff(21)
    mk['brent_rv'] = np.log(mk['brent']).diff().rolling(21, min_periods=15).std() * ann
    mk['nok_ret'] = np.log(mk['usdnok']).diff(21)
    mk['nok_rv'] = np.log(mk['usdnok']).diff().rolling(21, min_periods=15).std() * ann
    mk['rate_chg'] = mk['policy_rate'].diff(63)
    mk = mk[['mkt_rv_m', 'mkt_rv_q', 'mkt_ret_m', 'vix', 'vix_chg', 'brent_ret', 'brent_rv', 'nok_ret', 'nok_rv', 'policy_rate', 'rate_chg']]
    d = d.merge(mk, left_on='date', right_index=True, how='left')
    d['moy'] = d['date'].dt.month

    # who is in the universe at each month end
    d['in_universe'] = (d['n_hist'] >= MIN_HISTORY) & (np.exp(d['log_turn']) >= MIN_TURNOVER) & (np.exp(d['log_price']) >= MIN_PRICE)
    notes['stock_months'] = int(len(d))
    notes['stock_months_in_universe'] = int(d['in_universe'].sum())
    return d, notes


FEATURES = ['rv_d', 'rv_w', 'rv_m', 'rv_q', 'rv_y', 'ewma', 'semi_m', 'park_m', 'skew_q', 'kurt_q', 'ret_m', 'ret_y', 'dd_y',
            'min_ret_q', 'beta', 'idio_q', 'log_turn', 'amihud', 'zero_ret', 'log_price',
            'mkt_rv_m', 'mkt_rv_q', 'mkt_ret_m', 'vix', 'vix_chg', 'brent_ret', 'brent_rv', 'nok_ret', 'nok_rv', 'policy_rate', 'rate_chg', 'moy']
LOG_FEATURES = ['rv_d', 'rv_w', 'rv_m', 'rv_q', 'rv_y', 'ewma', 'semi_m', 'park_m', 'idio_q', 'mkt_rv_m', 'mkt_rv_q', 'vix', 'brent_rv', 'nok_rv']
