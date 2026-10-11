# Weekly market analysis: method

Instructions for the agent that writes one market and competitor analysis a week for
hansmeyertischbein.github.io. Follow them exactly. The site is in English.

## 1. Choose the market

- Pick one market that has **not** been covered before. Covered markets are listed in
  `markets/markets.json`. Never repeat a market or a near-duplicate of one.
- Prefer markets that are in the news this week, that have a clear set of competitors and
  enough public numbers: concentrated Norwegian or Nordic industries, listed companies,
  regulated sectors. Vary the sector from week to week (consumer, energy, finance,
  industry, technology, transport, health and so on).
- Define the market precisely in one sentence: product, customers, geography.

## 2. Research

- Search the web for current figures. Every number on the page must come from a source
  you have opened, and be linked in the Sources list. Prefer primary sources: company
  reports and stock exchange releases, regulators, statistics agencies, industry bodies.
  Use news only for events, and say who reported it.
- Use the latest available year and say which year each figure is for.
- If a figure cannot be verified, leave it out or describe it in words. Never estimate a
  number and present it as fact. Rounded figures should say "about".
- Typical searches: market size and growth, market shares, the three to six largest
  companies and their latest results, recent entries, exits and acquisitions, regulation
  and political proposals, prices, technology shifts, sustainability requirements.
- Aim for 8 to 15 searches. Stop when every section can be written from what you found.

## 3. Write the page

Create `markets/<slug>/index.html`, where `<slug>` is a short lowercase name such as
`norwegian-grocery-retail`. Copy the structure of an existing analysis in `markets/`
(the first one is `markets/norwegian-grocery-retail/`), including the head, the menu,
the footer and `<link rel="stylesheet" href="/markets/markets.css?v=1">`.

Sections, in this order:

1. **Header**: title "Market analysis: <market>", a lede of two sentences that states the
   main conclusion, the date ("Week 42, 2026") and the AI note (see below).
2. **Key points**: three to five short bullets a busy reader can stop after.
3. **The market**: definition, size, growth and structure, with a small table or the
   `outputs` key-figure block. Calculate the HHI from market shares when shares exist and
   link to `/hhi/`.
4. **Competitors**: a table with each main company's share or size, positioning, recent
   development and one strength and one weakness. Follow with two or three sentences on
   how they compete (price, range, location, technology, brand).
5. **PESTEL**: one card per factor (Political, Economic, Social, Technological,
   Environmental, Legal). Each card has a qualitative assessment of two to four
   sentences explaining *why* it matters for the companies in this market, an impact
   rating (`High`, `Medium` or `Low`) and a direction (`Headwind`, `Tailwind` or `Mixed`).
   The ratings are judgements: base them on the reasoning in the card, and be willing to
   rate a factor `Low`.
6. **SWOT**: for the market leader, or for a named challenger if that is more
   interesting. Three to four points per quadrant, each one specific to this company and
   this market. Strengths and weaknesses are internal; opportunities and threats come from
   the PESTEL and competitor analysis. Name the company in the heading.
7. **What to watch**: three dated or datable things that would change the picture
   (decisions, results, launches).
8. **Sources**: numbered list of every source used, with links.

Writing rules: plain, confident English; short paragraphs; no filler phrases; no
hyphens or dashes as sentence punctuation; numbers with units and years. Qualitative
judgements must give a reason. Do not use internal data from any employer, and do not
write about If P&C Insurance or compare against it.

**AI note**: under the lede, add
`<p class="ai-note">Researched and drafted by an AI research agent that runs every week. Every figure links to its source.</p>`

## 4. Add it to the site

1. Add an entry at the top of `projects/entries.json`:
   `date` = today (YYYY-MM-DD), `topic` = "Strategy and decisions",
   `title` = "Market analysis: <market>", `url` = "/markets/<slug>/",
   `text` = the main conclusion in one or two sentences,
   `tools` = "Market analysis, competitor analysis, PESTEL, SWOT",
   `links` = [{"text": "Read the analysis", "url": "/markets/<slug>/"}].
2. Add the market to `markets/markets.json` (slug, name, date).
3. Run `python3 tools/build_projects.py` from the repository root. It rebuilds the
   projects feed and the count on the landing page.

## 5. Check before publishing

- Open the page at 390 px and about 1100 px wide: no console errors, no sideways
  scrolling, tables scroll inside their box.
- Check every number on the page against its source once more.
- Check that the page has all eight sections and every PESTEL card has a rating and a
  direction.

## 6. Publish and report

- Commit with a short English message ("Add weekly market analysis: <market>") and push to
  `main`. Wait for GitHub Pages to finish building.
- Send Hans a short message in Norwegian: which market, the main conclusion in one
  sentence, and the link. If anything failed, say exactly what and stop without
  publishing half-finished work.
