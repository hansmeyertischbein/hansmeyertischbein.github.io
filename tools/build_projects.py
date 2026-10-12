"""Rebuild the projects feed (projects/index.html) and the project count on the
landing page (index.html) from projects/entries.json.

Usage, from the repository root:  python3 tools/build_projects.py

entries.json holds one object per project:
  date   ISO date (YYYY-MM-DD), or a year (YYYY) if the exact date is unknown
  topic  one of the "topics" listed in the file
  title  plain text
  url    link for the title, or null
  text   short description (may contain HTML entities such as &amp;)
  tools  methods and tools, comma separated
  links  list of {"text", "url"}
The feed is sorted newest first and grouped by month.
"""
import datetime
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://hansmeyertischbein.github.io'
CSS_VERSION = 3        # /site.css?v=N
FEED_CSS_VERSION = 5   # projects/projects.css?v=N
FEED_JS_VERSION = 1    # projects/projects.js?v=N


def slug(topic):
    return topic.lower().split()[0]


def short(topic):
    return 'Strategy' if topic.startswith('Strategy') else topic


def fmt(d):
    if len(d) == 4:
        return d, d, None
    dt = datetime.date.fromisoformat(d)
    return d, f'{dt.day} {dt:%b} {dt.year}', f'{dt:%B %Y}'


def entry(p):
    iso, label, _ = fmt(p['date'])
    title = f'<a href="{p["url"]}">{p["title"]}</a>' if p.get('url') else p['title']
    links = ''.join(f'\n            <a href="{l["url"]}">{l["text"]}</a>' for l in p.get('links', []))
    links = f'\n          <div class="links">{links}\n          </div>' if links else ''
    return f'''      <li class="entry" data-topic="{slug(p['topic'])}">
        <time class="entry-date" datetime="{iso}">{label}</time>
        <article class="entry-body">
          <p class="entry-kicker">{p['topic']}</p>
          <h2 class="entry-title">{title}</h2>
          <p>{p['text']}</p>
          <p class="tools">{p['tools']}</p>{links}
        </article>
      </li>'''


def build():
    data = json.load(open(os.path.join(ROOT, 'projects', 'entries.json'), encoding='utf-8'))
    topics, P = data['topics'], data['entries']
    for p in P:
        assert p['topic'] in topics, f'Unknown topic: {p["topic"]}'
    P.sort(key=lambda p: p['date'], reverse=True)

    groups = []
    for p in P:
        m = fmt(p['date'])[2] or 'Earlier'
        if not groups or groups[-1][0] != m:
            groups.append((m, []))
        groups[-1][1].append(p)

    feed = '\n'.join(f'''    <section class="feed-month">
      <h2 class="feed-month-title">{m}</h2>
      <ol class="feed">
{chr(10).join(entry(p) for p in items)}
      </ol>
    </section>''' for m, items in groups)
    chips = '\n'.join(
        f'        <button class="chip" type="button" data-filter="{f}" aria-pressed="{"true" if f == "all" else "false"}">{lbl}</button>'
        for f, lbl in [('all', 'All')] + [(slug(t), short(t)) for t in topics])
    desc = 'Analyses, tools and writing on finance, insurance and decision-making, newest first.'

    page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FBFCFD">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0F1626">
<meta name="color-scheme" content="light dark">
<title>Projects – Hans Meyer Tischbein</title>
<meta name="description" content="{html.escape(desc, quote=True)}">
<meta property="og:type" content="website">
<meta property="og:title" content="Projects – Hans Meyer Tischbein">
<meta property="og:description" content="{html.escape(desc, quote=True)}">
<meta property="og:url" content="{BASE}/projects/">
<meta property="og:image" content="{BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="HMT">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Public+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css?v={CSS_VERSION}">
<link rel="stylesheet" href="projects.css?v={FEED_CSS_VERSION}">
</head>
<body>

<header class="nav">
  <div class="wrap">
    <a class="nav-name" href="/">Hans Meyer Tischbein</a>
    <ul class="nav-links">
      <li><a href="/cv/">CV</a></li>
      <li><a href="/projects/" aria-current="page">Projects</a></li>
    </ul>
  </div>
</header>

<main>
  <div class="wrap">
    <header class="page-head">
      <h1>Projects</h1>
      <p class="lede">Analyses, tools and writing on finance, insurance and decision-making. Newest first.</p>
      <div class="chips" role="group" aria-label="Filter by topic">
{chips}
      </div>
    </header>

{feed}
    <p class="feed-empty" hidden>No projects in this topic yet.</p>
  </div>
</main>

<footer>
  <div class="wrap">Oslo, Norway</div>
</footer>

<script src="projects.js?v={FEED_JS_VERSION}"></script>
</body>
</html>
'''
    open(os.path.join(ROOT, 'projects', 'index.html'), 'w', encoding='utf-8').write(page)

    # Landing page: number of projects and date of the latest one
    landing_path = os.path.join(ROOT, 'index.html')
    landing = open(landing_path, encoding='utf-8').read()
    latest = next(fmt(p['date'])[1] for p in P if len(p['date']) > 4)
    new, n = re.subn(r'<span class="choice-desc">\d+ analyses, tools and write-ups\. Latest [^.<]+\.</span>',
                     f'<span class="choice-desc">{len(P)} analyses, tools and write-ups. Latest {latest}.</span>', landing)
    assert n == 1, 'Could not find the Projects summary on the landing page'
    open(landing_path, 'w', encoding='utf-8').write(new)
    print(f'Built {len(P)} entries, latest {latest}')


if __name__ == '__main__':
    build()
