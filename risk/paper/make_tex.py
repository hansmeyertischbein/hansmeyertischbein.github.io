"""Writes paper/paper.tex from the backtest results, so every number in the paper comes from the same file as the web page."""
import json
import numpy as np
import pandas as pd

B = json.load(open('live/risk/results/backtest.json'))
P = pd.read_pickle('work/pred_15.pkl')
P = P[P['rv_next'].notna()]
vol = {r['model']: r for r in B['vol']}
fall = {r['model']: r for r in B['fall']}
T, pf, st = B['test'], B['portfolio'], B['portfolio']['stats']
boot, bml = B['auc_vollogit_vs_logit'], B['auc_ml_vs_logit']
v, vh = B['var']['ML'], B['var']['HAR']
cc = B['crosscheck_euronext']
NAMES = {'EWMA': 'EWMA', 'HAR': 'HAR', 'LightGBM': 'LightGBM', 'RandomForest': 'Random forest', 'MLP': 'Neural network (MLP)', 'ML': 'ML average',
         'Logit': 'Logistic regression', 'ML_cal': 'ML average, Platt-recalibrated', 'VolLogit': 'Two-step (ML volatility $\\to$ logit)'}


def f(x, d=3):
    return '--' if x is None else f'{x:,.{d}f}'.replace(',', '\\,')


def pc(x, d=1):
    if x is None:
        return '--'
    t = f'{abs(x) * 100:.{d}f}\\%'
    return ('$-$' if x < 0 and round(abs(x) * 100, d) > 0 else '') + t


def p(x):
    return '--' if x is None else ('$<$0.001' if x < 0.001 else f'{x:.3f}')


months = {'01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June', '07': 'July', '08': 'August',
          '09': 'September', '10': 'October', '11': 'November', '12': 'December'}
def mname(s):
    y, m = s.split('-')
    return f'{months[m]} {y}'


# Table 1: sample by year
desc = P.groupby(P['date'].dt.year).agg(n=('ticker', 'size'), stocks=('ticker', 'nunique'), rv=('rv_next', 'median'), fall=('fall_next', 'mean'))
t1 = '\n'.join(f'{y} & {int(r.n)} & {int(r.stocks)} & {pc(r.rv)} & {pc(r.fall)} \\\\' for y, r in desc.iterrows())
t1 += f'\n\\midrule\nAll & {T["rows"]} & {T["stocks"]} & {pc(P["rv_next"].median())} & {pc(T["fall_rate"])} \\\\'

t2 = '\n'.join(f'{NAMES[m]}{" (ref.)" if m in ("HAR", "EWMA") else ""} & {f(vol[m]["mse_log"])} & {f(vol[m]["qlike"])} & '
               f'{"--" if m == "HAR" else ("$-$" if vol[m]["r2_vs_har"] > 0 else "+") + f"{abs(vol[m]['r2_vs_har']) * 100:.1f}" + chr(92) + "%"} & '
               f'{"--" if m == "HAR" else f(vol[m]["dm_t_mse_log"], 2)} & {"--" if m == "HAR" else p(vol[m]["dm_p_mse_log"])} & '
               f'{"--" if m == "HAR" else p(vol[m]["dm_p_qlike"])} & {f(vol[m]["rank_corr"], 2)} \\\\'
               for m in ('HAR', 'EWMA', 'LightGBM', 'RandomForest', 'MLP', 'ML'))
t3 = '\n'.join(f'{NAMES[m]}{" (ref.)" if m == "Logit" else ""} & {f(fall[m]["auc"])} & {f(fall[m]["brier"], 4)} & {pc(fall[m]["brier_skill"])} & '
               f'{f(fall[m]["log_loss"])} & {pc(fall[m]["hit_rate_top10"], 0)} & {"--" if m == "Logit" else p(fall[m]["dm_p_brier"])} \\\\'
               for m in ('Logit', 'LightGBM', 'RandomForest', 'MLP', 'ML', 'ML_cal', 'VolLogit'))
t4 = '\n'.join(f'{r["threshold"]}\\% & {pc(r["base_rate"])} & {f(r["auc_Logit"])} & {f(r["auc_ML"])} & {f(r["auc_VolLogit"])} & '
               f'{pc(r["brier_skill_Logit"])} & {pc(r["brier_skill_VolLogit"])} \\\\' for r in B['thresholds'])
per = {r['period']: r for r in B['by_period']}
t5rows = [('All test months', 'All test months'), ('Covid crash (Feb--May 2020)', 'Covid crash (Feb–May 2020)'), ('2022 energy and rates shock', '2022 energy and rates shock')]
t5 = '\n'.join(f'{a} & {int(per[b]["n"])} & {pc(per[b]["fall_rate"])} & {f(per[b]["mse_HAR"])} & {f(per[b]["mse_ML"])} & {f(per[b]["auc_Logit"])} & {f(per[b]["auc_VolLogit"])} \\\\'
               for a, b in t5rows)
t6 = '\n'.join(f'{lab} & {pc(st[k]["ann_return"])} & {pc(st[k]["ann_vol"])} & {f(st[k]["sharpe"], 2)} & {pc(st[k]["max_drawdown"], 0)} \\\\'
               for k, lab in (('low_ML', 'Low risk, ML'), ('low_HAR', 'Low risk, HAR'), ('osebx', 'OSEBX'), ('high_ML', 'High risk, ML'), ('equal_weight', 'All stocks, equal weight$^{a}$')))
imp_v = ', '.join(f'{x["label"].lower()} ({x["share"] * 100:.0f}\\%)' for x in B['importance']['vol'][:3])
cal_top = B['calibration']['VolLogit'][-1]
n_cc = len(cc)
n_cc_ok = sum(1 for k in cc if cc[k].get('days_diff_over_1pct') == 0)
cc_days = min(cc[k]['days'] for k in cc)

DEFS = {
 'rv_d': 'Absolute return on the day', 'rv_w': 'Realised volatility over 5 days', 'rv_m': 'Realised volatility over 21 days', 'rv_q': 'Realised volatility over 63 days',
 'rv_y': 'Realised volatility over 252 days', 'ewma': 'Exponentially weighted volatility, decay 0.94', 'semi_m': 'Volatility of negative returns over 21 days',
 'park_m': 'Parkinson volatility from daily high and low over 21 days', 'skew_q': 'Skewness of daily returns over 63 days', 'kurt_q': 'Excess kurtosis over 63 days',
 'ret_m': 'Log return over 21 days', 'ret_y': 'Log return over 252 days', 'dd_y': 'Log distance from the 252-day high', 'min_ret_q': 'Worst daily return over 63 days',
 'beta': 'Beta to the equal-weighted market over 252 days', 'idio_q': 'Volatility of residuals from the market model over 63 days',
 'log_turn': 'Log median daily turnover in NOK over 63 days', 'amihud': 'Log Amihud illiquidity, mean of $|r|$/turnover over 63 days',
 'zero_ret': 'Share of days with zero return over 63 days', 'log_price': 'Log share price', 'mkt_rv_m': 'Volatility of the equal-weighted market over 21 days',
 'mkt_rv_q': 'Volatility of the equal-weighted market over 63 days', 'mkt_ret_m': 'Return of the equal-weighted market over 21 days', 'vix': 'VIX level, previous day',
 'vix_chg': 'Log change in VIX over 21 days', 'brent_ret': 'Log change in Brent over 21 days', 'brent_rv': 'Volatility of Brent over 21 days',
 'nok_ret': 'Log change in USD/NOK over 21 days', 'nok_rv': 'Volatility of USD/NOK over 21 days', 'policy_rate': 'Norges Bank policy rate',
 'rate_chg': 'Change in the policy rate over 63 days', 'moy': 'Calendar month'}
sys_path = __import__('sys').path.insert(0, 'live/risk/pipeline')
from backtest import LABELS
inputs = '\n'.join(f'{LABELS[k]} & {DEFS[k]} \\\\' for k in DEFS) + '\nSector & Dummies for eleven sector groups \\\\'
params = '\n'.join(f"{q['year']} & {q['train_rows']:,} & {q['lgb_vol']['num_leaves']} / {q['lgb_vol']['min_child_samples']} & {q['lgb_vol']['n_estimators']} & {q['lgb_fall']['num_leaves']} / {q['lgb_fall']['min_child_samples']} & {q['lgb_fall']['n_estimators']} & {q['test_rows']} \\\\" for q in B['params'])
subs = {
    'INPUTS': inputs, 'PARAMS': params,
    'FIRST': mname(T['first_month']), 'LAST': mname(T['last_month']), 'MONTHS': str(T['months']), 'ROWS': f'{T["rows"]:,}', 'STOCKS': str(T['stocks']),
    'AVG': f'{T["avg_stocks_per_month"]:.0f}', 'FALLRATE': pc(T['fall_rate']),
    'MLGAIN': f'{vol["ML"]["r2_vs_har"] * 100:.0f}', 'DMT': f(vol['ML']['dm_t_mse_log'], 2), 'RFGAIN': f'{vol["RandomForest"]["r2_vs_har"] * 100:.0f}',
    'LGBGAIN': f'{vol["LightGBM"]["r2_vs_har"] * 100:.0f}', 'MLPGAIN': f'{vol["MLP"]["r2_vs_har"] * 100:.1f}', 'MLPP': p(vol['MLP']['dm_p_mse_log']),
    'AUCREF': f(fall['Logit']['auc']), 'AUCML': f(fall['ML']['auc']), 'AUCVL': f(fall['VolLogit']['auc']), 'AUCCAL': f(fall['ML_cal']['auc']),
    'BDIFF': f(boot['diff']), 'BLO': f(boot['ci_low'], 4), 'BHI': f(boot['ci_high'], 3), 'BSHARE': f'{boot["share_above_zero"] * 100:.0f}',
    'MLLO': f(bml['ci_low']), 'MLHI': f(bml['ci_high']),
    'VARRATE': pc(v['rate'], 2), 'VARN': f'{v["n"]:,}', 'VARP': f(v['kupiec_p'], 2), 'VARHAR': pc(vh['rate'], 2), 'VARCL': str(v['months_over_20pct']),
    'LOWVOL': pc(st['low_ML']['ann_vol']), 'OSEVOL': pc(st['osebx']['ann_vol']), 'LOWSR': f(st['low_ML']['sharpe'], 2), 'OSESR': f(st['osebx']['sharpe'], 2),
    'HARSR': f(st['low_HAR']['sharpe'], 2), 'TURNML': pc(pf['turnover_ML'], 0), 'TURNHAR': pc(pf['turnover_HAR'], 0),
    'LOWDD': pc(st['low_ML']['max_drawdown'], 0), 'HARDD': pc(st['low_HAR']['max_drawdown'], 0),
    'PFFIRST': mname(pf['first_month']), 'PFLAST': mname(pf['last_month']),
    'IMPV': imp_v, 'CALP': pc(cal_top['pred']), 'CALA': pc(cal_top['actual']),
    'NCC': str(n_cc), 'NCCOK': str(n_cc_ok), 'CCDAYS': str(cc_days),
    'DROP0': f'{B["data"]["dropped_zero_volume"]:,}', 'COVIDREF': f(per['Covid crash (Feb–May 2020)']['auc_Logit']), 'COVIDVL': f(per['Covid crash (Feb–May 2020)']['auc_VolLogit']),
    'Y22HAR': f(per['2022']['mse_HAR']), 'Y22ML': f(per['2022']['mse_ML']),
    'T1': t1, 'T2': t2, 'T3': t3, 'T4': t4, 'T5': t5, 'T6': t6,
}
tex = open('paper/paper_template.tex', encoding='utf-8').read()
for k, val in subs.items():
    tex = tex.replace('<<' + k + '>>', val)
assert '<<' not in tex, [l for l in tex.splitlines() if '<<' in l][:5]
open('paper/paper.tex', 'w', encoding='utf-8').write(tex)
print('tex written')
