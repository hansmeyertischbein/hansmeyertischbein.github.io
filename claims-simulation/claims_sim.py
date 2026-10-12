"""Monte Carlo simulation of an insurer's annual claims.

The same model as the browser version at
https://hansmeyertischbein.github.io/claims-simulation/

Each year: claim count ~ Poisson(policies x frequency); claim sizes ~ lognormal
with a given mean and coefficient of variation. With probability `storm_prob`
a storm adds Poisson(policies x storm_share) extra claims. The insurer pays
each claim less the deductible, and nothing for claims below it.

Usage:  python claims_sim.py
Needs:  numpy
"""
import numpy as np
from math import erf, log, sqrt


def norm_cdf(x):
    return 0.5 * (1 + erf(x / sqrt(2)))


def lognormal_params(mean, cv):
    s2 = np.log(1 + cv ** 2)
    return np.log(mean) - s2 / 2, np.sqrt(s2)


def expected_payment(severity, cv, deductible):
    """E[max(X - d, 0)] for a lognormal claim X with the given mean and cv."""
    if deductible <= 0:
        return severity
    mu, sigma = lognormal_params(severity, cv)
    ld = log(deductible)
    return severity * norm_cdf((mu + sigma ** 2 - ld) / sigma) - deductible * norm_cdf((mu - ld) / sigma)


def simulate(policies=10_000, freq=0.08, severity=30_000, cv=3.0,
             storm_prob=0.03, storm_share=0.05, deductible=8_000, years=20_000, seed=20260705):
    rng = np.random.default_rng(seed)
    mu, sigma = lognormal_params(severity, cv)
    counts = rng.poisson(policies * freq, years)
    storms = rng.random(years) < storm_prob
    counts[storms] += rng.poisson(policies * storm_share, storms.sum())
    # Draw every claim at once, then add them up year by year
    claims = np.maximum(rng.lognormal(mu, sigma, counts.sum()) - deductible, 0)
    year_index = np.repeat(np.arange(years), counts)
    return np.bincount(year_index, weights=claims, minlength=years)


def main():
    policies, freq, severity, cv, storm_prob, storm_share, loading, deductible = 10_000, 0.08, 30_000, 3.0, 0.03, 0.05, 0.15, 8_000
    totals = simulate(policies, freq, severity, cv, storm_prob, storm_share, deductible)
    expected = policies * (freq + storm_prob * storm_share) * expected_payment(severity, cv, deductible)
    premium = expected * (1 + loading)
    var_995 = np.quantile(totals, 0.995)

    print(f"Deductible per claim:    NOK {deductible:,.0f}")
    print(f"Expected annual claims:  NOK {expected:,.0f}")
    print(f"Simulated mean:          NOK {totals.mean():,.0f}")
    print(f"Premium (+{loading:.0%}):        NOK {premium:,.0f}")
    print(f"Share of loss years:     {np.mean(totals > premium):.1%}")
    print(f"1-in-200 year (99.5%):   NOK {var_995:,.0f}")
    print(f"Capital needed:          NOK {max(0, var_995 - premium):,.0f}")

    # The law of large numbers, and where it stops working
    print("\nRelative volatility (sd / mean) by portfolio size:")
    for n in (1_000, 10_000, 100_000):
        for sp in (0.0, storm_prob):
            t = simulate(n, freq, severity, cv, sp, storm_share, deductible, years=5_000)
            label = "with storms" if sp else "no storms  "
            print(f"  {n:>7,} policies, {label}: {t.std() / t.mean():.1%}")


    print("\nWhat the deductible does (10,000 policies, with storms):")
    for d in (0, 4_000, 8_000, 20_000):
        t = simulate(policies, freq, severity, cv, storm_prob, storm_share, d)
        e = policies * (freq + storm_prob * storm_share) * expected_payment(severity, cv, d)
        print(f"  NOK {d:>6,}: expected claims NOK {e:,.0f}, sd/mean {t.std() / t.mean():.1%}, 1-in-200 NOK {np.quantile(t, 0.995):,.0f}")


if __name__ == "__main__":
    main()
