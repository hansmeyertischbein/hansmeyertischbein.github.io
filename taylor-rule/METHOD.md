# Taylor rule for Norges Bank: update method

Instructions for the agent that updates `/taylor-rule/` after every Norges Bank policy rate
decision. The page reads `taylor-rule/data.json`, which is built by
`tools/build_taylor.py` from the raw files in `taylor-rule/data/`. Never edit
`data.json` by hand. The site is in English; the message to Hans is in Norwegian.

Accuracy comes first. Every number must come from the source listed below, be read
from the source itself (not from news), and pass the cross-checks. If a figure cannot be
verified, leave the old file unchanged for that series and say so in the report.

## 1. The decision

1. Open Norges Bank's list of decisions:
   https://www.norges-bank.no/en/topics/monetary-policy/policy-rate/Key-policy-rate-Monetary-policy-meetings-and-changes-in-the-policy-rate/
2. If the policy rate changed at today's meeting, add a line to `data/policy_rate.csv`
   (`announced` = announcement date YYYY-MM-DD, `rate_pct` = new rate with two decimals).
   The file lists changes only, so add nothing when the rate is unchanged.
3. Confirm the decision against the press release for the day on norges-bank.no.
4. In `data/norges_bank.json` set `decision_date` to today's announcement date and
   `policy_rate` to the rate now in force.

## 2. Monetary Policy Report (March, June, September and December meetings)

When the decision comes with a new Monetary Policy Report, update in `data/norges_bank.json`:

- `report` and `report_url` (the report's landing page on norges-bank.no)
- `neutral_real_rate_low` and `neutral_real_rate_high` (the report's estimate of the
  neutral real policy rate, usually in Chapter 3 or a box on the rate path)
- `mainland_gdp_growth_projection` (Table 2.1 or the projections table in the annex:
  mainland GDP, annual change, every projection year)
- `cpi_ate_projection` (current year only, if stated as a number)
- `output_gap_assessment` and `rate_path_summary` (one sentence each, in plain English,
  paraphrasing the report)

Without a new report, leave these fields as they are.

## 3. Inflation: CPI-ATE

Source: Statistics Norway table 14704. Fetch with the PxWebApi (one value per line):

- 12-month rate:
  `https://data.ssb.no/api/pxwebapi/v2/tables/14704/data?lang=en&valueCodes%5BKPIavledetSerie%5D=KPI-JAE&valueCodes%5BVareTjenesteGrp%5D=00&valueCodes%5BContentsCode%5D=Tolvmanedersendring&valueCodes%5BTid%5D=from(2025M01)&outputFormat=csv&stub=Tid`
- Index (2025 = 100): the same URL with `ContentsCode%5D=KPIJustIndMnd`

Add every new month to `data/cpi_ate.csv` (`month` YYYY-MM, `index_2025_100`,
`twelve_month_pct`). If Statistics Norway has revised earlier months, update those lines too.
The build script checks that each 12-month rate matches the index within 0.2 points.

## 4. Mainland GDP

Source: Statistics Norway table 09190, `Makrost` = `bnpb.nr23_9fn` (GDP Mainland Norway).

- Level: `https://data.ssb.no/api/pxwebapi/v2/tables/09190/data?lang=en&valueCodes%5BMakrost%5D=bnpb.nr23_9fn&valueCodes%5BContentsCode%5D=FastePriserSesJust&valueCodes%5BTid%5D=from(2005K1)&outputFormat=csv&stub=Tid&heading=ContentsCode,Makrost`
- Growth: the same URL with `ContentsCode%5D=VolumEndrSesJust`

Seasonally adjusted figures are revised every quarter, so replace the whole of
`data/gdp_mainland.csv` (`quarter` like 2026Q2, level in NOK million, quarter-on-quarter
growth). The build script checks levels against growth. If the base year of constant prices
changes, rename the column and the reading of it in `tools/build_taylor.py`.

## 5. Calendar

Keep `next_meetings` in `data/norges_bank.json` equal to the future decision dates on
https://www.norges-bank.no/en/news-events/calendar/policy-rate-decisions/ . When Norges Bank
publishes a new year's dates, add them, and tell Hans in the report so that new scheduled
runs can be created for them.

## 6. Build and check

1. Run `python3 tools/build_taylor.py` from the repository root (install numpy with
   `pip install --break-system-packages numpy` if it is missing). It must finish without an
   assertion error.
2. Check the printed last quarters: policy rate, CPI-ATE and output gap look plausible
   compared with the previous build (the gap rarely moves more than 0.5 points between
   builds; if it does, say why in the report).
3. Open `/taylor-rule/` at 390 px and about 1100 px wide with a local server: no console
   errors other than blocked web fonts, no sideways scrolling, the headline sentence and the
   key figures show the new numbers, the table view opens.
4. If the rate changed, update the date in `projects/entries.json` only if Hans has asked
   for a new feed entry; otherwise leave the feed alone.

## 7. Publish and report

- Commit with the message `Update Taylor rule after Norges Bank decision <date>` and push to
  `main`.
- Send Hans a short message in Norwegian: the decision (rate and change), what the Taylor rule
  now says with the default settings, the difference to the policy rate, and the link
  https://hansmeyertischbein.github.io/taylor-rule/ . If anything failed, say exactly what,
  and do not publish half-updated data.
