"""Fetch daily prices for the Oslo Børs risk project and write them with a log.

Runs in GitHub Actions (the runners can reach Yahoo Finance and Norges Bank).
Output goes to OUT (default risk-data/): prices.csv.gz, macro.csv, log.json.
Every step is logged, and the script never stops on one failed series.
"""
import csv
import datetime as dt
import io
import json
import os
import sys
import time
import traceback

import pandas as pd
import requests
import yfinance as yf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT', 'risk-data')
START = '2000-01-01'
os.makedirs(OUT, exist_ok=True)
log = {'run_utc': dt.datetime.utcnow().isoformat(timespec='seconds') + 'Z', 'python': sys.version.split()[0],
       'yfinance': yf.__version__, 'stocks': {}, 'macro': {}, 'second_source': {}, 'errors': []}


def history(symbol, tries=4):
    """Daily OHLCV with both raw close and adjusted close, retried on rate limits."""
    for k in range(tries):
        try:
            df = yf.Ticker(symbol).history(start=START, auto_adjust=False, actions=True, raise_errors=True)
            if df is not None and len(df):
                df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
                return df
            return None
        except Exception as e:  # noqa: BLE001 - log and retry
            msg = str(e)
            if k == tries - 1 or ('delisted' in msg.lower() or 'no data' in msg.lower() or 'not found' in msg.lower()):
                log['errors'].append(f'{symbol}: {msg[:200]}')
                return None
            time.sleep(5 * (k + 1))
    return None


def stocks():
    frames = []
    with open(os.path.join(HERE, 'universe.csv'), encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        got = None
        for mn in r['candidates'].split('|'):
            sym = mn + '.OL'
            df = history(sym)
            time.sleep(0.6)
            if df is not None and len(df) > 20:
                got = (mn, sym, df)
                break
        if not got:
            log['stocks'][r['name']] = {'ok': False, 'tried': r['candidates']}
            continue
        mn, sym, df = got
        d = pd.DataFrame({'date': df.index, 'ticker': mn, 'open': df['Open'], 'high': df['High'], 'low': df['Low'],
                          'close': df['Close'], 'adj_close': df['Adj Close'], 'volume': df['Volume'],
                          'dividend': df.get('Dividends', 0.0), 'split': df.get('Stock Splits', 0.0)})
        frames.append(d)
        log['stocks'][r['name']] = {'ok': True, 'ticker': mn, 'rows': len(d), 'first': str(d['date'].min().date()),
                                    'last': str(d['date'].max().date()), 'zero_volume_days': int((d['volume'] == 0).sum())}
    if frames:
        allp = pd.concat(frames, ignore_index=True)
        allp.to_csv(os.path.join(OUT, 'prices.csv.gz'), index=False, float_format='%.6g', compression='gzip')
        log['prices_rows'] = int(len(allp))


MACRO_YAHOO = {
    'osebx': ['OSEBX.OL', '^OSEBX'],
    'obx': ['OBX.OL', '^OBX'],
    'oseax': ['^OSEAX', 'OSEAX.OL'],
    'vix': ['^VIX'],
    'brent': ['BZ=F'],
    'usdnok': ['NOK=X', 'USDNOK=X'],
    'eurnok': ['EURNOK=X'],
}
NB = {
    'policy_rate': 'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=csv&startPeriod=2000-01-01&locale=en',
    'nok_3m_bill': 'https://data.norges-bank.no/api/data/GOVT_GENERIC_RATES/B.3M.TBIL?format=csv&startPeriod=2000-01-01&locale=en',
    'nok_10y_bond': 'https://data.norges-bank.no/api/data/GOVT_GENERIC_RATES/B.10Y.GBON?format=csv&startPeriod=2000-01-01&locale=en',
}


def macro():
    series = {}
    for key, syms in MACRO_YAHOO.items():
        for sym in syms:
            df = history(sym)
            time.sleep(0.6)
            if df is not None and len(df) > 20:
                series[key] = df['Close']
                if key in ('osebx', 'obx', 'oseax'):
                    series[key + '_high'] = df['High']
                    series[key + '_low'] = df['Low']
                log['macro'][key] = {'ok': True, 'symbol': sym, 'rows': len(df), 'first': str(df.index.min().date()), 'last': str(df.index.max().date())}
                break
        else:
            log['macro'][key] = {'ok': False, 'tried': syms}
    for key, url in NB.items():
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            d = pd.read_csv(io.StringIO(r.text), sep=None, engine='python')
            tcol = next(c for c in d.columns if 'TIME' in c.upper())
            vcol = next(c for c in d.columns if 'OBS_VALUE' in c.upper())
            s = pd.Series(pd.to_numeric(d[vcol], errors='coerce').values, index=pd.to_datetime(d[tcol])).dropna()
            series[key] = s
            log['macro'][key] = {'ok': True, 'source': 'Norges Bank', 'rows': len(s), 'first': str(s.index.min().date()), 'last': str(s.index.max().date())}
        except Exception as e:  # noqa: BLE001
            log['macro'][key] = {'ok': False, 'error': str(e)[:200]}
    if series:
        m = pd.DataFrame(series).sort_index()
        m.index.name = 'date'
        m.to_csv(os.path.join(OUT, 'macro.csv'), float_format='%.6g')


ISIN = {'EQNR': 'NO0010096985', 'DNB': 'NO0010161896', 'NHY': 'NO0005052605', 'MOWI': 'NO0003054108',
        'TEL': 'NO0010063308', 'ORK': 'NO0003733800', 'YAR': 'NO0010208051', 'NOD': 'NO0003055501', 'HEX': 'NO0003067902'}


def euronext():
    """Second source: daily closes from Euronext (the exchange) for eight large stocks, last two years."""
    end = dt.date.today()
    start = end - dt.timedelta(days=730)
    for mn, isin in ISIN.items():
        q = {'format': 'csv', 'decimal_separator': '.', 'date_form': 'Y-m-d', 'op': '', 'adjusted': 'N', 'base100': '',
             'startdate': str(start), 'enddate': str(end)}
        url = f'https://live.euronext.com/en/ajax/AwlHistoricalPrice/getFullDownloadAjax/{isin}-XOSL'
        hdr = {'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'Referer': f'https://live.euronext.com/en/product/equities/{isin}-XOSL'}
        tries = [('get', lambda: requests.get(url, params=q, headers=hdr, timeout=60)),
                 ('post_qs', lambda: requests.post(url, params=q, data=q, headers=hdr, timeout=60)),
                 ('post_json', lambda: requests.post(url, json=q, headers=hdr, timeout=60))]
        info = {}
        for how, call in tries:
            try:
                r = call()
                txt = r.text
                info[how] = {'status': r.status_code, 'head': txt[:160]}
                if r.status_code == 200 and len(txt) > 200 and ',' in txt[:400] or ';' in txt[:400] and r.status_code == 200:
                    with open(os.path.join(OUT, f'euronext_{mn}.csv'), 'w', encoding='utf-8') as f:
                        f.write(txt)
                    info['ok'] = how
                    break
            except Exception as e:  # noqa: BLE001
                info[how] = {'error': str(e)[:200]}
        log['second_source']['euronext_' + mn] = info
        time.sleep(1)


def second_source():
    """Cross-check a few stocks against Stooq (a second, independent price source)."""
    for mn in ['EQNR', 'DNB', 'NHY', 'MOWI', 'TEL', 'ORK', 'YAR', 'NOD']:
        try:
            r = requests.get(f'https://stooq.com/q/d/l/?s={mn.lower()}.no&i=d', timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
            txt = r.text
            if r.status_code != 200 or not txt.startswith('Date'):
                log['second_source'][mn] = {'ok': False, 'status': r.status_code, 'head': txt[:120]}
                continue
            d = pd.read_csv(io.StringIO(txt), parse_dates=['Date'])
            d.to_csv(os.path.join(OUT, f'stooq_{mn}.csv'), index=False)
            log['second_source'][mn] = {'ok': True, 'rows': len(d), 'first': str(d['Date'].min().date())}
        except Exception as e:  # noqa: BLE001
            log['second_source'][mn] = {'ok': False, 'error': str(e)[:200]}


for step in (stocks, macro, euronext):
    try:
        step()
    except Exception:  # noqa: BLE001
        log['errors'].append(f'{step.__name__} crashed: ' + traceback.format_exc()[-600:])
    with open(os.path.join(OUT, 'log.json'), 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=1)
print(json.dumps({k: (len(v) if isinstance(v, (dict, list)) else v) for k, v in log.items()}))
