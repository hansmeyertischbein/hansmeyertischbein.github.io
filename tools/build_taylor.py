"""Build taylor-rule/data.json from the raw files in taylor-rule/data/.

Usage, from the repository root:  python3 tools/build_taylor.py

Inputs (update these, never data.json by hand):
  policy_rate.csv     every change in the key policy rate (announcement date, new rate)
  cpi_ate.csv         CPI-ATE, monthly index and 12-month rate (Statistics Norway, table 14704)
  gdp_mainland.csv    mainland GDP, constant prices, seasonally adjusted (Statistics Norway, table 09190)
  norges_bank.json    figures from the latest Monetary Policy Report and the meeting calendar

The output gap is our own estimate: log mainland GDP minus a Hodrick-Prescott trend.
To soften the end-point problem of the filter, GDP is extended with Norges Bank's
projected annual growth before filtering, and the extension is dropped afterwards.
"""
import csv
import datetime as dt
import json
import math
import os

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'taylor-rule', 'data')
START = '2015Q1'


def read_csv(name):
    with open(os.path.join(DIR, name), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def qkey(y, q):
    return f'{y}Q{q}'


def quarter_of(month):  # '2026-09' -> '2026Q3'
    y, m = month.split('-')
    return qkey(int(y), (int(m) - 1) // 3 + 1)


def hp_trend(y, lam):
    n = len(y)
    D = np.zeros((n - 2, n))
    for i in range(n - 2):
        D[i, i:i + 3] = [1, -2, 1]
    return np.linalg.solve(np.eye(n) + lam * D.T @ D, y)


def build():
    nb = json.load(open(os.path.join(DIR, 'norges_bank.json'), encoding='utf-8'))

    # --- Mainland GDP and output gap ---
    gdp = read_csv('gdp_mainland.csv')
    quarters = [r['quarter'] for r in gdp]
    levels = [float(r['nok_million_2023_prices_sa']) for r in gdp]
    # cross-check the levels against SSB's own quarter-on-quarter growth
    for i in range(1, len(gdp)):
        g = (levels[i] / levels[i - 1] - 1) * 100
        assert abs(g - float(gdp[i]['qoq_pct'])) < 0.06, f'GDP check failed at {quarters[i]}'

    # extend with Norges Bank's projected annual growth
    proj = {int(k): v for k, v in nb['mainland_gdp_growth_projection'].items()}
    last_y, last_q = int(quarters[-1][:4]), int(quarters[-1][-1])
    ext = list(levels)
    year_sum = lambda y: sum(l for q, l in zip(quarters, levels) if q.startswith(str(y)))
    y, q = last_y, last_q
    if last_q < 4 and last_y in proj:
        # equal quarterly growth over the rest of the year that hits the annual projection
        target = year_sum(last_y - 1) * (1 + proj[last_y] / 100)
        known = year_sum(last_y)
        k = 4 - last_q
        lo, hi = -0.05, 0.05
        for _ in range(100):
            g = (lo + hi) / 2
            s = known + sum(levels[-1] * (1 + g) ** (j + 1) for j in range(k))
            lo, hi = (g, hi) if s < target else (lo, g)
        for j in range(k):
            ext.append(levels[-1] * (1 + g) ** (j + 1))
        y, q = last_y, 4
    for yy in sorted(p for p in proj if p > y):
        g = (1 + proj[yy] / 100) ** 0.25 - 1
        for _ in range(4):
            ext.append(ext[-1] * (1 + g))
    logy = np.log(np.array(ext))
    gaps = {}
    for lam in (1600, 40000):
        trend = hp_trend(logy, lam)
        gaps[lam] = [(logy[i] - trend[i]) * 100 for i in range(len(levels))]

    # --- CPI-ATE, quarterly average of the 12-month rate ---
    cpi = [r for r in read_csv('cpi_ate.csv') if r['twelve_month_pct']]
    rows = read_csv('cpi_ate.csv')
    idx = {r['month']: float(r['index_2025_100']) for r in rows}
    for r in cpi:  # cross-check against the index (index is rounded, so allow 0.2 pp)
        y, m = r['month'].split('-')
        prev = f'{int(y) - 1}-{m}'
        calc = (idx[r['month']] / idx[prev] - 1) * 100
        assert abs(calc - float(r['twelve_month_pct'])) <= 0.2, f'CPI-ATE check failed at {r["month"]}'
    qcpi = {}
    for r in cpi:
        qcpi.setdefault(quarter_of(r['month']), []).append(float(r['twelve_month_pct']))
    last_month = cpi[-1]['month']

    # --- Policy rate at end of each quarter ---
    pr = [(dt.date.fromisoformat(r['announced']), float(r['rate_pct'])) for r in read_csv('policy_rate.csv')]
    pr.sort()

    def rate_at(d):
        v = None
        for day, rate in pr:
            if day <= d:
                v = rate
        return v

    def target_at(d):
        v = None
        for t in nb['inflation_target']:
            if dt.date.fromisoformat(t['from']) <= d:
                v = t['target']
        return v

    out = []
    today = dt.date.today()
    for i, qk in enumerate(quarters):
        if qk < START:
            continue
        y, q = int(qk[:4]), int(qk[-1])
        end = dt.date(y, 3 * q, 1) + dt.timedelta(days=32)
        end = end.replace(day=1) - dt.timedelta(days=1)
        months = qcpi.get(qk, [])
        out.append({
            'q': qk,
            'rate': rate_at(end),
            'cpi': round(sum(months) / len(months), 2) if len(months) == 3 else None,
            'gap': round(float(gaps[1600][i]), 2),
            'gap_smooth': round(float(gaps[40000][i]), 2),
            'target': target_at(end),
        })
    # quarters with CPI-ATE but no GDP yet (latest quarter): carry the policy rate and CPI, gap unknown
    last = quarters[-1]
    for qk in sorted(qcpi):
        if qk > last and len(qcpi[qk]) == 3:
            y, q = int(qk[:4]), int(qk[-1])
            end = (dt.date(y, 3 * q, 1) + dt.timedelta(days=32)).replace(day=1) - dt.timedelta(days=1)
            out.append({'q': qk, 'rate': rate_at(min(end, today)), 'cpi': round(sum(qcpi[qk]) / 3, 2),
                        'gap': None, 'gap_smooth': None, 'target': target_at(end)})

    data = {
        'built': today.isoformat(),
        'latest': {
            'policy_rate': pr[-1][1], 'policy_rate_date': pr[-1][0].isoformat(),
            'cpi_month': last_month, 'cpi': float(cpi[-1]['twelve_month_pct']),
            'gdp_quarter': quarters[-1],
        },
        'norges_bank': nb,
        'quarters': out,
        'decisions': [{'date': d.isoformat(), 'rate': r} for d, r in pr if d >= dt.date(2014, 12, 1)],
    }
    with open(os.path.join(ROOT, 'taylor-rule', 'data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Built {len(out)} quarters, latest GDP {quarters[-1]}, latest CPI-ATE {last_month}')
    return data


if __name__ == '__main__':
    d = build()
    for r in d['quarters'][-12:]:
        print(r)
