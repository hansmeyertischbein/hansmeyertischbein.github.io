# Forecasting risk on Oslo Børs with machine learning

Web page: https://hansmeyertischbein.github.io/risk/ · Paper: `Forecasting_risk_Oslo_Bors.pdf`

## Pipeline (`pipeline/`)
- `fetch.py` – daily prices from Yahoo Finance, market data, Norges Bank rates, and Euronext closes for a cross-check. Runs in the GitHub Action `.github/workflows/risk-data.yml`; raw data is stored on the branch `risk-data`.
- `features.py` – cleaning, the 32 inputs and the two targets (next-month volatility, a fall of 10/15/20%).
- `model.py` – the models (EWMA, HAR, LightGBM, random forest, neural network, logistic regression, two-step) and the walk-forward test.
- `evaluate.py` – Diebold–Mariano tests, AUC, Brier skill, calibration, VaR backtest, low-risk portfolio.
- `backtest.py` – runs the walk-forward test and writes `results/backtest.json`.
- `live.py` – the monthly forecasts, scores and live portfolio in `live/`.

## Rerun
```
git fetch origin risk-data && git worktree add /tmp/risk-data origin/risk-data
pip install "yfinance>=0.2.58,<0.3" pandas numpy requests lightgbm scikit-learn scipy
python risk/pipeline/backtest.py /tmp/risk-data     # about 30 minutes
```
`paper/` builds the PDF from the same results (XeLaTeX).

Not investment advice.
