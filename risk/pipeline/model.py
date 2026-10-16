"""Risk models for Oslo Børs stocks: training, prediction and the walk-forward test.

Volatility (target: log of next-month realised volatility)
  EWMA        reference, no fitting: today's exponentially weighted volatility
  HAR         reference, pooled OLS on daily, weekly, monthly and quarterly volatility
  LightGBM, RandomForest, MLP (five seeds averaged), and ML = their average
Large fall (target: a fall of 15% or more within the next month)
  Logit       reference, logistic regression on log EWMA and monthly volatility
  LightGBM, RandomForest, MLP, ML = their average
  ML_cal      the ML average recalibrated (Platt scaling) on the last two years of the training window
  VolLogit    two steps: the ML volatility forecast fed into a one-variable logistic regression

Every model is fitted only on rows whose targets were known at the forecast date.
The last 24 months of each training window are held out once to choose LightGBM
settings, to scale variance forecasts, and to fit the calibrators; the final models
are then refitted on the whole window.
"""
import os
import warnings

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from features import FEATURES, LOG_FEATURES

warnings.filterwarnings('ignore')
SEED = 7
HAR_X = ['rv_d', 'rv_w', 'rv_m', 'rv_q']
GRID = [dict(num_leaves=nl, min_child_samples=mc, learning_rate=0.03) for nl in (7, 15) for mc in (40, 100)]
SECTORS = pd.read_csv(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sectors.csv')).set_index('ticker')['sector']
SECTOR_LIST = sorted(SECTORS.unique())


def design(d):
    X = d[FEATURES].copy()
    for c in LOG_FEATURES:
        X[c] = np.log(X[c].clip(lower=1e-4))
    sec = d['ticker'].map(SECTORS).fillna('Other')
    for s in SECTOR_LIST:
        X['sec_' + s.split()[0].lower()] = (sec == s).astype(float)
    return X


class Imputer:
    def fit(self, X):
        self.med = X.median()
        return self

    def __call__(self, X):
        return X.fillna(self.med).fillna(0)


def _lgb(objective, n, g):
    cls = lgb.LGBMClassifier if objective == 'binary' else lgb.LGBMRegressor
    return cls(objective=objective, n_estimators=n, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
               reg_lambda=1.0, random_state=SEED, verbose=-1, **g)


def tune_lgb(Xa, ya, Xb, yb, objective):
    """Small grid with early stopping on the held-out block. Returns settings and number of trees."""
    best = None
    for g in GRID:
        m = _lgb(objective, 2000, g)
        m.fit(Xa, ya, eval_set=[(Xb, yb)], callbacks=[lgb.early_stopping(100, verbose=False)])
        score = list(m.best_score_['valid_0'].values())[0]
        if best is None or score < best[0]:
            best = (score, g, max(50, m.best_iteration_ or 200))
    return best[1], best[2]


def _rf_reg():
    return RandomForestRegressor(n_estimators=400, min_samples_leaf=30, max_features=0.33, n_jobs=-1, random_state=SEED)


def _rf_cls():
    return RandomForestClassifier(n_estimators=400, min_samples_leaf=30, max_features=0.33, n_jobs=-1, random_state=SEED)


def _mlp_reg():
    return [make_pipeline(StandardScaler(), MLPRegressor(hidden_layer_sizes=(32, 16), alpha=1e-2, learning_rate_init=1e-3, max_iter=800,
                                                         early_stopping=True, validation_fraction=0.15, n_iter_no_change=30, random_state=s)) for s in range(5)]


def _mlp_cls():
    return [make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(32, 16), alpha=1e-1, learning_rate_init=1e-3, max_iter=800,
                                                          early_stopping=True, validation_fraction=0.15, n_iter_no_change=30, random_state=s)) for s in range(5)]


def _logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


class Models:
    """All fitted models for one forecast date."""

    def fit(self, tr, X, fall_col='fall_next'):
        cut = tr['month'].max()
        va_start = cut - 23
        fit_i, va_i = tr[tr['month'] < va_start].index, tr[tr['month'] >= va_start].index
        Xtr = X.loc[tr.index]
        self.imp = Imputer().fit(Xtr)
        Xi = self.imp(Xtr)
        y, f = np.log(tr['rv_next']), tr[fall_col]
        self.cols = list(X.columns)

        # stage 1: fit on all but the last two years, predict the held-out block
        self.g_vol, n_vol = tune_lgb(Xtr.loc[fit_i], y.loc[fit_i], Xtr.loc[va_i], y.loc[va_i], 'regression')
        self.g_fall, n_fall = tune_lgb(Xtr.loc[fit_i], f.loc[fit_i], Xtr.loc[va_i], f.loc[va_i], 'binary')
        va = {}
        va['EWMA'] = np.log(tr.loc[va_i, 'ewma'].clip(lower=1e-4)).values
        va['HAR'] = LinearRegression().fit(Xi.loc[fit_i, HAR_X], y.loc[fit_i]).predict(Xi.loc[va_i, HAR_X])
        va['LightGBM'] = _lgb('regression', n_vol, self.g_vol).fit(Xtr.loc[fit_i], y.loc[fit_i]).predict(Xtr.loc[va_i])
        va['RandomForest'] = _rf_reg().fit(Xi.loc[fit_i], y.loc[fit_i]).predict(Xi.loc[va_i])
        va['MLP'] = np.mean([m.fit(Xi.loc[fit_i], y.loc[fit_i]).predict(Xi.loc[va_i]) for m in _mlp_reg()], axis=0)
        va['ML'] = (va['LightGBM'] + va['RandomForest'] + va['MLP']) / 3
        yva, fva = y.loc[va_i].values, f.loc[va_i].values
        self.scale = {k: float(np.mean(np.exp(2 * (yva - v)))) for k, v in va.items()}
        rv_va = tr.loc[va_i, 'ret_next'].values / np.sqrt(21 / 252)
        self.var_q = {k: float(np.nanquantile(rv_va / np.exp(va[k]), 0.05)) for k in ('ML', 'HAR')}
        pf_va = (_lgb('binary', n_fall, self.g_fall).fit(Xtr.loc[fit_i], f.loc[fit_i]).predict_proba(Xtr.loc[va_i])[:, 1]
                 + _rf_cls().fit(Xi.loc[fit_i], f.loc[fit_i]).predict_proba(Xi.loc[va_i])[:, 1]
                 + np.mean([m.fit(Xi.loc[fit_i], f.loc[fit_i]).predict_proba(Xi.loc[va_i])[:, 1] for m in _mlp_cls()], axis=0)) / 3
        self.cal = LogisticRegression(C=1e3).fit(_logit(pf_va).reshape(-1, 1), fva)          # Platt scaling
        self.vollogit = LogisticRegression(C=1e3).fit(va['ML'].reshape(-1, 1), fva)        # two-step model

        # stage 2: final models on the whole window
        self.har = LinearRegression().fit(Xi[HAR_X], y)
        self.lgb_vol = _lgb('regression', n_vol, self.g_vol).fit(Xtr, y)
        self.rf_vol = _rf_reg().fit(Xi, y)
        self.mlp_vol = [m.fit(Xi, y) for m in _mlp_reg()]
        self.logit = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(Xi[['ewma', 'rv_m']], f)
        self.lgb_fall = _lgb('binary', n_fall, self.g_fall).fit(Xtr, f)
        self.rf_fall = _rf_cls().fit(Xi, f)
        self.mlp_fall = [m.fit(Xi, f) for m in _mlp_cls()]
        self.base_rate = float(f.mean())
        self.params = {'lgb_vol': {**self.g_vol, 'n_estimators': n_vol}, 'lgb_fall': {**self.g_fall, 'n_estimators': n_fall},
                       'train_rows': int(len(tr)), 'train_last_month': str(cut)}
        return self

    def predict(self, te, X, contributions=False):
        Xte = X.loc[te.index, self.cols]
        Xi = self.imp(Xte)
        pr = pd.DataFrame(index=te.index)
        pr['vol_EWMA'] = np.log(te['ewma'].clip(lower=1e-4))
        pr['vol_HAR'] = self.har.predict(Xi[HAR_X])
        pr['vol_LightGBM'] = self.lgb_vol.predict(Xte)
        pr['vol_RandomForest'] = self.rf_vol.predict(Xi)
        pr['vol_MLP'] = np.mean([m.predict(Xi) for m in self.mlp_vol], axis=0)
        pr['vol_ML'] = pr[['vol_LightGBM', 'vol_RandomForest', 'vol_MLP']].mean(axis=1)
        for k, v in self.scale.items():
            pr[f'scale_{k}'] = v
        pr['fall_Logit'] = self.logit.predict_proba(Xi[['ewma', 'rv_m']])[:, 1]
        pr['fall_LightGBM'] = self.lgb_fall.predict_proba(Xte)[:, 1]
        pr['fall_RandomForest'] = self.rf_fall.predict_proba(Xi)[:, 1]
        pr['fall_MLP'] = np.mean([m.predict_proba(Xi)[:, 1] for m in self.mlp_fall], axis=0)
        pr['fall_ML'] = pr[['fall_LightGBM', 'fall_RandomForest', 'fall_MLP']].mean(axis=1)
        pr['fall_ML_cal'] = self.cal.predict_proba(_logit(pr['fall_ML'].values).reshape(-1, 1))[:, 1]
        pr['fall_VolLogit'] = self.vollogit.predict_proba(pr['vol_ML'].values.reshape(-1, 1))[:, 1]
        pr['base_rate'] = self.base_rate
        pr['var_q05'] = self.var_q['ML']
        pr['var_q05_har'] = self.var_q['HAR']
        if not contributions:
            return pr
        cv = pd.DataFrame(self.lgb_vol.booster_.predict(Xte, pred_contrib=True)[:, :-1], columns=self.cols, index=te.index)
        cf = pd.DataFrame(self.lgb_fall.booster_.predict(Xte, pred_contrib=True)[:, :-1], columns=self.cols, index=te.index)
        return pr, cv.assign(target='vol'), cf.assign(target='fall')


def prepare(panel):
    d = panel[panel['in_universe']].copy()
    return d, design(d)


def walk_forward(panel, first_test_year=2015, fall_col='fall_next', verbose=True):
    """For each test year, train on rows up to November of the year before and forecast its twelve month ends."""
    d, X = prepare(panel)
    known = d[d['rv_next'].notna() & d[fall_col].notna()]
    years = sorted(y for y in d['date'].dt.year.unique() if y >= first_test_year)
    out, params, contrib = [], [], []
    for Y in years:
        cut = pd.Period(f'{Y - 1}-11', 'M')
        tr = known[known['month'] <= cut]
        te = d[(d['date'].dt.year == Y) & d['rv_next'].notna()]
        if te.empty:
            continue
        M = Models().fit(tr, X, fall_col)
        pr, cv, cf = M.predict(te, X, contributions=True)
        params.append({'year': int(Y), 'test_rows': int(len(te)), **M.params})
        out.append(te[['date', 'month', 'ticker', 'rv_next', fall_col, 'ret_next', 'ewma']].rename(columns={fall_col: 'fall_next'})
                   .assign(y_vol=np.log(te['rv_next'])).join(pr))
        contrib += [cv, cf]
        if verbose:
            print(Y, len(tr), len(te), M.params['lgb_vol'], M.params['lgb_fall'], flush=True)
    return pd.concat(out), params, pd.concat(contrib)
