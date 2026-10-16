"""Walk-forward test of risk forecasts for Oslo Børs stocks.

For each test year, every model is trained only on rows whose targets were known
before the year started, then used for the twelve month ends of that year.

Volatility (target: log of next-month realised volatility)
  EWMA        reference, no fitting: today's exponentially weighted volatility
  HAR         reference, pooled OLS on daily, weekly, monthly and quarterly volatility
  LightGBM, Random forest, MLP, and their average (ML ensemble)
Large fall (target: falls 15% or more within the next month)
  Logit       reference, logistic regression on log EWMA and monthly volatility
  LightGBM, Random forest, MLP, and their average
"""
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


def design(d):
    X = d[FEATURES].copy()
    for c in LOG_FEATURES:
        X[c] = np.log(X[c].clip(lower=1e-4))
    return X


class Imputer:
    def fit(self, X):
        self.med = X.median()
        return self

    def __call__(self, X):
        return X.fillna(self.med).fillna(0)


def fit_lgb(Xtr, ytr, Xva, yva, objective):
    """Small grid with early stopping on the last two years of the training window, then refit on all of it."""
    best = None
    for g in GRID:
        m = lgb.LGBMRegressor(objective=objective, n_estimators=2000, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                              reg_lambda=1.0, random_state=SEED, verbose=-1, **g) if objective != 'binary' else \
            lgb.LGBMClassifier(objective='binary', n_estimators=2000, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                               reg_lambda=1.0, random_state=SEED, verbose=-1, **g)
        m.fit(Xtr, ytr, eval_set=[(Xva, yva)], callbacks=[lgb.early_stopping(100, verbose=False)])
        score = m.best_score_['valid_0'][list(m.best_score_['valid_0'])[0]]
        if best is None or score < best[0]:
            best = (score, g, max(50, m.best_iteration_ or 200))
    _, g, n = best
    cls = lgb.LGBMClassifier if objective == 'binary' else lgb.LGBMRegressor
    kw = dict(objective=objective) if objective != 'binary' else {}
    final = cls(n_estimators=n, subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0, random_state=SEED, verbose=-1, **kw, **g)
    return final, {**g, 'n_estimators': n}


def walk_forward(panel, first_test_year=2015, last_month=None):
    d = panel[panel['in_universe']].copy()
    d = d[d['rv_next'].notna() | (d['month'] == d['month'].max())]
    d['y_vol'] = np.log(d['rv_next'])
    X_all = design(d)
    years = sorted(y for y in d['date'].dt.year.unique() if y >= first_test_year)
    out, params, contrib = [], [], []
    for Y in years:
        cut = pd.Period(f'{Y - 1}-11', 'M')          # targets of rows up to November are known by year end
        tr = d[(d['month'] <= cut) & d['rv_next'].notna()]
        te = d[d['date'].dt.year == Y]
        if last_month is not None:
            te = te[te['month'] <= last_month]
        if te.empty:
            continue
        va_start = cut - 23
        fit_i, va_i = tr[tr['month'] < va_start].index, tr[tr['month'] >= va_start].index
        Xtr, Xte = X_all.loc[tr.index], X_all.loc[te.index]
        imp = Imputer().fit(Xtr)
        Xtr_i, Xte_i = imp(Xtr), imp(Xte)
        ytr, ftr = tr['y_vol'], tr['fall_next']
        pr = pd.DataFrame(index=te.index)

        # ---- volatility ----
        def vol_models():
            return {
                'HAR': lambda: LinearRegression(),
                'RandomForest': lambda: RandomForestRegressor(n_estimators=400, min_samples_leaf=30, max_features=0.33, n_jobs=-1, random_state=SEED),
                'MLP': lambda: [make_pipeline(StandardScaler(), MLPRegressor(hidden_layer_sizes=(32, 16), alpha=1e-2, learning_rate_init=1e-3, max_iter=800,
                                                                       early_stopping=True, validation_fraction=0.15, n_iter_no_change=30, random_state=s)) for s in range(5)],
            }

        def fit_pred(name, make, Xa, ya, Xb):
            cols = HAR_X if name == 'HAR' else Xa.columns
            m = make()
            if isinstance(m, list):
                for mm in m:
                    mm.fit(Xa[cols], ya)
                return np.mean([mm.predict(Xb[cols]) for mm in m], axis=0)
            return m.fit(Xa[cols], ya).predict(Xb[cols])

        lg, gp = fit_lgb(Xtr.loc[fit_i], ytr.loc[fit_i], Xtr.loc[va_i], ytr.loc[va_i], 'regression')
        # honest validation predictions (models fitted without the last two years) give each model's variance scale
        va_pred = {'EWMA': np.log(tr.loc[va_i, 'ewma'].clip(lower=1e-4)).values}
        lg_va = lgb.LGBMRegressor(**lg.get_params()).fit(Xtr.loc[fit_i], ytr.loc[fit_i])
        va_pred['LightGBM'] = lg_va.predict(Xtr.loc[va_i])
        for name, make in vol_models().items():
            va_pred[name] = fit_pred(name, make, Xtr_i.loc[fit_i], ytr.loc[fit_i], Xtr_i.loc[va_i])
        va_pred['ML'] = (va_pred['LightGBM'] + va_pred['RandomForest'] + va_pred['MLP']) / 3
        yva = ytr.loc[va_i].values
        for k, v in va_pred.items():
            pr[f'scale_{k}'] = float(np.mean(np.exp(2 * (yva - v))))
        # final models on the whole training window
        pr['vol_EWMA'] = np.log(te['ewma'].clip(lower=1e-4))
        lg.fit(Xtr, ytr)
        pr['vol_LightGBM'] = lg.predict(Xte)
        for name, make in vol_models().items():
            pr[f'vol_{name}'] = fit_pred(name, make, Xtr_i, ytr, Xte_i)
        pr['vol_ML'] = pr[['vol_LightGBM', 'vol_RandomForest', 'vol_MLP']].mean(axis=1)
        resid_ml = yva - va_pred['ML']
        resid_har = yva - va_pred['HAR']
        c = lg.booster_.predict(Xte, pred_contrib=True)
        cc = pd.DataFrame(c[:, :-1], columns=FEATURES, index=te.index)
        cc['target'] = 'vol'
        contrib.append(cc)

        # ---- large fall ----
        lo = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(Xtr_i[['ewma', 'rv_m']], ftr)
        pr['fall_Logit'] = lo.predict_proba(Xte_i[['ewma', 'rv_m']])[:, 1]
        lgc, gpc = fit_lgb(Xtr.loc[fit_i], ftr.loc[fit_i], Xtr.loc[va_i], ftr.loc[va_i], 'binary')
        lgc.fit(Xtr, ftr)
        pr['fall_LightGBM'] = lgc.predict_proba(Xte)[:, 1]
        rfc = RandomForestClassifier(n_estimators=400, min_samples_leaf=30, max_features=0.33, n_jobs=-1, random_state=SEED).fit(Xtr_i, ftr)
        pr['fall_RandomForest'] = rfc.predict_proba(Xte_i)[:, 1]
        mlpc = [make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(32, 16), alpha=1e-1, learning_rate_init=1e-3, max_iter=800,
                                                              early_stopping=True, validation_fraction=0.15, n_iter_no_change=30, random_state=s)).fit(Xtr_i, ftr)
                for s in range(5)]
        pr['fall_MLP'] = np.mean([m.predict_proba(Xte_i)[:, 1] for m in mlpc], axis=0)
        pr['fall_ML'] = pr[['fall_LightGBM', 'fall_RandomForest', 'fall_MLP']].mean(axis=1)
        pr['base_rate'] = ftr.mean()
        cf = lgc.booster_.predict(Xte, pred_contrib=True)
        ccf = pd.DataFrame(cf[:, :-1], columns=FEATURES, index=te.index)
        ccf['target'] = 'fall'
        contrib.append(ccf)

        # standardised next-month return quantile in training, for a 5% VaR from each vol forecast
        rv_va = tr.loc[va_i, 'ret_next'].values / np.sqrt(21 / 252)
        pr['var_q05'] = float(np.nanquantile(rv_va / np.exp(va_pred['ML']), 0.05))
        pr['var_q05_har'] = float(np.nanquantile(rv_va / np.exp(va_pred['HAR']), 0.05))
        params.append({'year': int(Y), 'train_rows': int(len(tr)), 'test_rows': int(len(te)), 'lgb_vol': gp, 'lgb_fall': gpc})
        out.append(te[['date', 'month', 'ticker', 'rv_next', 'fall_next', 'ret_next', 'y_vol', 'ewma']].join(pr))
        print(Y, len(tr), len(te), gp, gpc, flush=True)
    return pd.concat(out), params, pd.concat(contrib)
