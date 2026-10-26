# Weekly market analysis: method

Instructions for the agent that writes one market and competitor analysis a week for
hansmeyertischbein.github.io. Follow them exactly. The site is in English.

Version 2, in use from week 44 of 2026. Earlier analyses followed version 1, which is in
this file's history: it had no investor view, risks or exhibit, and no independent review.

The standard is a note that a senior analyst at a top-tier investment bank or strategy
firm would send to clients without edits: a clear view, backed by numbers, that tells an
informed reader something they did not already know and what it means for the companies
involved.

## 1. Choose the market

- Pick one market that has **not** been covered before. Covered markets are listed in
  `markets/markets.json`. Never repeat a market or a near-duplicate of one.
- Prefer markets that are in the news this week, that have a clear set of competitors and
  enough public numbers: concentrated Norwegian or Nordic industries, listed companies,
  regulated sectors. Prefer markets where at least one listed company is exposed, so the
  investor view has substance. Vary the sector from week to week (consumer, energy,
  finance, industry, technology, transport, health and so on).
- Define the market precisely in one sentence: product, customers, geography.

## 2. Research

- Search the web for current figures. Every number on the page must come from a source
  you have opened, and be linked in the Sources list, or be an own calculation (below).
  Prefer primary sources: company reports and stock exchange releases, regulators,
  statistics agencies, industry bodies. Use news only for events, and say who reported
  it. When a figure reaches you through an aggregator, find and cite the original.
- Use the latest available year and say which year each figure is for.
- Triangulate the figures the view rests on: use two independent sources where possible.
  If they differ, say so and say which one you use and why.
- If a figure cannot be verified, leave it out or describe it in words. Never estimate a
  number and present it as fact. Rounded figures should say "about". When rounded parts
  do not add up to a stated total, use the source's total and say the parts are rounded.
- Own calculations are encouraged when every input is sourced: an HHI from market shares,
  growth split into price and volume, a sensitivity such as "a 1% price change is worth
  about NOK X a year". Mark each one "own calculation" and name its inputs. A forecast or
  scenario is allowed only when it is labelled as a scenario and its assumptions are
  stated.
- Typical searches: market size and growth, market shares, the three to six largest
  companies and their latest results and guidance, recent entries, exits and
  acquisitions, regulation and political proposals, prices, technology shifts, analyst
  commentary.
- Aim for 12 to 20 searches. Stop when every section can be written from what you found.

## 3. Form the view before writing

- Write the thesis in one or two sentences: what is changing in this market, who wins and
  who loses, and why it matters now. It must be specific enough that someone informed
  could disagree with it.
- Identify the two or three drivers that decide the outcome (for example price against
  volume, the cost of capacity, a regulatory decision) and quantify them.
- Where a source shows what the market expects (company guidance, analyst commentary,
  pricing), say where this analysis agrees and where it differs. Never invent a
  consensus.
- List what would prove the view wrong.

## 4. Write the page

Create `markets/<slug>/index.html`, where `<slug>` is a short lowercase name such as
`norwegian-grocery-retail`. Copy the structure of the most recent analysis in `markets/`,
including the head, the menu, the footer and
`<link rel="stylesheet" href="/markets/markets.css?v=1">`.

Sections, in this order:

1. **Header**: title "Market analysis: <market>", a lede of two sentences that states the
   thesis (a view, not a description of the market), the date ("Week 42, 2026") and the
   AI note (see below).
2. **Key points**: three to five bullets a busy reader can stop after. Answer first: each
   bullet makes one claim and carries the number behind it.
3. **The market**: definition, size, growth and structure, with a small table or the
   `outputs` key-figure block. Split growth into its drivers (for example volume and
   price). Give at least one benchmark against comparable markets, Nordic or European,
   when a source allows it. Calculate the HHI from market shares when shares exist and
   link to `/hhi/`.
4. **Competitors**: a table with each main company's share or size, positioning, recent
   development (a dated event with a source, not a description), one strength and one
   weakness specific to this market. Follow with two or three sentences on how they
   compete and how their economics differ (margins, cost position) where figures exist.
5. **Investor view**: which listed companies are exposed (name and ticker), which part of
   their earnings the thesis touches, the direction, and the size where it can be
   calculated from sourced inputs. End the section with "This is analysis, not investment
   advice." If no listed company has meaningful exposure, say so in one sentence.
6. **PESTEL**: one card per factor (Political, Economic, Social, Technological,
   Environmental, Legal). Each card has a qualitative assessment of two to four
   sentences explaining *why* it matters, tied to a driver from the view or to a named
   company, an impact rating (`High`, `Medium` or `Low`) and a direction (`Headwind`,
   `Tailwind` or `Mixed`). The ratings are judgements: base them on the reasoning in the
   card, and be willing to rate a factor `Low`.
7. **SWOT**: for the market leader, or for a named challenger if that is more
   interesting. Three to four points per quadrant, each one specific to this company and
   this market. Strengths and weaknesses are internal; opportunities and threats come from
   the PESTEL and competitor analysis. Name the company in the heading.
8. **Risks to the view**: two or three things that would make the thesis wrong, each with
   the signal that would show it happening.
9. **What to watch**: three dated or datable catalysts (decisions, results, launches).
10. **Sources**: numbered list of every source used, with links.

**Exhibit**: include at least one chart as inline SVG that makes the thesis visible, placed
where it supports the argument. Its title is a sentence that states the takeaway ("Price,
not volume, drives revenue growth"), not a label. Use the colour variables from
`/site.css` so it works in light and dark mode, keep every label legible at 390 px, and
give the source under the chart.

Writing rules: answer first in every section; plain, confident English; short paragraphs
with one idea each; no filler phrases; no hyphens or dashes as sentence punctuation;
numbers with units and years. Every judgement gives a reason. Length about 1,800 to
2,800 words; when over, cut description and background before analysis. Do not use
internal data from any employer, and do not write about If P&C Insurance or compare
against it.

**AI note**: under the lede, add
`<p class="ai-note">Researched and drafted by an AI research agent that runs every week and reviewed by a second agent against a fixed standard. Every figure links to its source; own calculations are marked and name their inputs.</p>`

## 5. Quality review

A second agent that has not seen the drafting reviews the page the way the head of
research editing at a top-tier house reviews a junior analyst's note before it reaches
clients. It scores each criterion from 1 to 5:

| Criterion | What a 5 looks like |
|---|---|
| Thesis and insight | The lede makes a specific, arguable claim, and the key points tell an informed reader something non-obvious. |
| Evidence | Every figure is sourced or marked as an own calculation with its inputs; sums, shares and the HHI add up; key figures come from primary sources. |
| Quantification | The main drivers are split and sized, and at least one calculation links the thesis to revenue, margins or market shares. |
| Investor relevance | Listed exposure, risks to the view with their signals, and dated catalysts are concrete. |
| Frameworks | PESTEL and SWOT points are specific to this market and company; ratings are differentiated and justified. |
| Communication | Answer-first writing without filler; the exhibit's title states its takeaway; the page works at 390 px. |

Scale: 5 would go to clients unchanged; 4 needs small edits; 3 needs another draft; 2 or
lower would not reach a client.

The reviewer checks at least five key figures against their sources and every
calculation, and returns the scores and the fixes ranked by importance. Publish only when
Evidence is 5 and every other criterion is at least 4. Fix and review again, at most
twice. If the bar is still not met, do not publish.

## 6. Add it to the site

1. Add an entry at the top of `projects/entries.json`:
   `date` = today (YYYY-MM-DD), `topic` = "Strategy and decisions",
   `title` = "Market analysis: <market>", `url` = "/markets/<slug>/",
   `text` = the thesis in one or two sentences,
   `tools` = "Market analysis, competitor analysis, PESTEL, SWOT",
   `links` = [{"text": "Read the analysis", "url": "/markets/<slug>/"}].
2. Add the market to `markets/markets.json` (slug, name, date).
3. Run `python3 tools/build_projects.py` from the repository root. It rebuilds the
   projects feed and the count on the landing page.

## 7. Check before publishing

- Open the page at 390 px and about 1100 px wide, in light and dark mode: no console
  errors, no sideways scrolling, tables scroll inside their box, the exhibit is legible.
- Check every number on the page against its source once more, and redo every own
  calculation.
- Check that the page has all ten sections and every PESTEL card has a rating and a
  direction.

Publishing and the message to Hans are described in the task that runs this method.
