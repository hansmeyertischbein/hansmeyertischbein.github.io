// CV generator: a one-page CV with navy headings, right-aligned dates and bullet points,
// the same layout as my own CV. Live preview in HTML, download as Word (docx) or PDF (print).
// Hans Meyer Tischbein — https://hansmeyertischbein.github.io/cv-generator/

/* ---------- Content model ---------- */

const LABELS = {
  en: {
    summary: 'Key qualifications', education: 'Education', experience: 'Work experience',
    roles: 'Organizational roles and courses', courses: 'Courses',
    skills: 'Data skills, competencies and languages', dataSkills: 'Data Skills',
    competencies: 'Competencies', languages: 'Languages', references: 'References'
  },
  no: {
    summary: 'Nøkkelkompetanse', education: 'Utdanning', experience: 'Arbeidserfaring',
    roles: 'Verv og kurs', courses: 'Kurs',
    skills: 'Datakunnskaper, ferdigheter og språk', dataSkills: 'Datakunnskaper',
    competencies: 'Ferdigheter', languages: 'Språk', references: 'Referanser'
  }
};

const EXAMPLE = {
  lang: 'en',
  name: 'Ingrid Solberg',
  location: 'Oslo',
  phone: '+47 400 00 000',
  email: 'ingrid.solberg@example.com',
  linkedin: 'linkedin.com/in/ingrid-solberg',
  summary: 'Analytical economics student with experience from banking, customer service and student organisations. Comfortable with large data sets and quick to turn numbers into recommendations.',
  education: [
    { title: 'MSc in Business, Major in Finance', org: 'BI Norwegian Business School, Oslo', dates: '2026–2028', bullets: 'Courses in corporate finance, investments and econometrics' },
    { title: 'Bachelor in Economics and Business Administration', org: 'University of Bergen', dates: '2023–2026', bullets: 'GPA: B (4.1 / 5.0)\nBachelor thesis on interest rate pass-through in Norwegian banks' }
  ],
  experience: [
    { title: 'Customer Advisor, Part-time', org: 'Nordbank', dates: '2024–present', bullets: 'Advise private customers on savings, loans and insurance\nHandle around 40 customer enquiries per day with a satisfaction score above team average' },
    { title: 'Summer Intern, Finance', org: 'Vestland Energi', dates: '2025', bullets: 'Built a monthly cash flow model in Excel used by the finance team\nPresented a cost analysis to the CFO with three recommendations, two of them implemented' }
  ],
  roles: [
    { title: 'Head of Events', org: 'Student Finance Society', dates: '2024–2025', bullets: 'Planned eight company presentations with over 400 attendees in total' }
  ],
  courses: 'Excel for Financial Modelling\nIntroduction to Python for Data Analysis',
  dataSkills: 'Excel (advanced), PowerPoint\nPython and R for data analysis\nPower BI',
  competencies: 'Financial analysis, customer dialogue, structured work',
  languages: 'Norwegian (native) · English (fluent) · Spanish (basic)',
  references: 'Available upon request'
};

const EMPTY = {
  lang: 'en', name: '', location: '', phone: '', email: '', linkedin: '', summary: '',
  education: [blankEntry()], experience: [blankEntry()], roles: [],
  courses: '', dataSkills: '', competencies: '', languages: '', references: ''
};

function blankEntry() { return { title: '', org: '', dates: '', bullets: '' }; }
const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const clone = o => JSON.parse(JSON.stringify(o));
const linkUrl = s => (s ? (/^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '')) : '');
const linkText = s => String(s || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
const hasEntry = e => e && (e.title || e.org || e.dates || lines(e.bullets).length);

/* ---------- Word document (also runs in Node for testing) ---------- */

function buildDocx(D, cv) {
  const L = LABELS[cv.lang] || LABELS.en;
  const NAVY = '1F3864', INK = '111111', GREY = '333333', LINK = '1155CC', FONT = 'Calibri';
  const PAGE_W = 11906, MARGIN_X = 800, WIDTH = PAGE_W - 2 * MARGIN_X;
  const run = (text, o = {}) => new D.TextRun({ text, font: FONT, size: Math.round((o.size || 10) * 2), color: o.color || INK, bold: !!o.bold, italics: !!o.italics, characterSpacing: o.spacing });

  const heading = title => new D.Paragraph({
    children: [run(title.toUpperCase(), { bold: true, color: NAVY, size: 10, spacing: 10 })],
    spacing: { before: 140, after: 70 }, keepNext: true,
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: NAVY, space: 2 } }
  });
  const bullet = text => new D.Paragraph({ numbering: { reference: 'cv-bullets', level: 0 }, children: [run(text)], spacing: { after: 0 } });
  const entry = e => {
    const head = [run(e.title || '', { bold: true, size: 10.5 })];
    if (e.title && e.org) head.push(run('  |  ', { bold: true, size: 10.5 }));
    if (e.org) head.push(run(e.org, { bold: true, size: 10.5 }));
    if (e.dates) head.push(new D.TextRun({ children: [new D.Tab(), e.dates], font: FONT, size: 20, italics: true, color: GREY }));
    return [
      new D.Paragraph({ children: head, tabStops: [{ type: D.TabStopType.RIGHT, position: WIDTH }], spacing: { before: 60, after: 10 }, keepNext: lines(e.bullets).length > 0 }),
      ...lines(e.bullets).map(bullet)
    ];
  };

  const body = [];
  body.push(new D.Paragraph({ children: [run((cv.name || '').toUpperCase(), { bold: true, color: NAVY, size: 17 })], spacing: { after: 20 } }));

  const contact = [];
  const sep = () => run('   ·   ', { size: 9, color: GREY });
  [cv.location, cv.phone, cv.email].filter(Boolean).forEach(t => { if (contact.length) contact.push(sep()); contact.push(run(t, { size: 9, color: GREY })); });
  if (cv.linkedin) {
    if (contact.length) contact.push(sep());
    contact.push(new D.ExternalHyperlink({ link: linkUrl(cv.linkedin), children: [new D.TextRun({ text: linkText(cv.linkedin), font: FONT, size: 18, color: LINK, underline: {} })] }));
  }
  body.push(new D.Paragraph({ children: contact, spacing: { after: 80 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } } }));

  if (cv.summary) { body.push(heading(L.summary), new D.Paragraph({ children: [run(cv.summary)], spacing: { after: 40 } })); }
  const list = (key, label) => { const items = (cv[key] || []).filter(hasEntry); if (items.length) { body.push(heading(label)); items.forEach(e => body.push(...entry(e))); } };
  list('education', L.education);
  list('experience', L.experience);

  const roles = (cv.roles || []).filter(hasEntry), courses = lines(cv.courses);
  if (roles.length || courses.length) {
    body.push(heading(L.roles));
    roles.forEach(e => body.push(...entry(e)));
    if (courses.length) body.push(new D.Paragraph({ children: [run(`${L.courses}: ${courses.join(' · ')}`, { size: 9.5 })], spacing: { before: 40 } }));
  }

  const ds = lines(cv.dataSkills);
  if (ds.length || cv.competencies || cv.languages) {
    body.push(heading(L.skills));
    const sub = t => new D.Paragraph({ children: [run(t, { bold: true, color: NAVY })], spacing: { after: 20 } });
    const p = t => new D.Paragraph({ children: [run(t)], spacing: { after: 20 } });
    const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const cell = children => new D.TableCell({ children: children.length ? children : [new D.Paragraph('')], width: { size: WIDTH / 2, type: D.WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none }, margins: { left: 100, right: 100 } });
    const left = ds.length ? [sub(L.dataSkills), ...ds.map(p)] : [];
    const right = [];
    if (cv.competencies) right.push(sub(L.competencies), p(cv.competencies));
    if (cv.languages) right.push(sub(L.languages), p(cv.languages));
    body.push(new D.Table({
      rows: [new D.TableRow({ children: [cell(left), cell(right)] })],
      width: { size: WIDTH, type: D.WidthType.DXA }, columnWidths: [WIDTH / 2, WIDTH / 2],
      borders: D.TableBorders.NONE
    }));
  }
  if (cv.references) body.push(heading(L.references), new D.Paragraph({ children: [run(cv.references)] }));

  return new D.Document({
    creator: cv.name || 'CV generator',
    title: cv.name ? `CV – ${cv.name}` : 'CV',
    styles: { default: { document: { run: { font: FONT, size: 20, color: INK } } } },
    numbering: { config: [{ reference: 'cv-bullets', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '●', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { size: 18 } } }] }] },
    sections: [{ properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 380, bottom: 400, left: MARGIN_X, right: MARGIN_X } } }, children: body }]
  });
}

if (typeof module !== 'undefined') module.exports = { buildDocx, EXAMPLE, LABELS };

/* ---------- Browser ---------- */

if (typeof document !== 'undefined') {
  const STORE = 'cv-generator-v1';
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cv = load() || clone(EXAMPLE);

  function load() { try { const s = localStorage.getItem(STORE); return s ? { ...clone(EMPTY), ...JSON.parse(s) } : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(cv)); } catch (e) { /* storage unavailable */ } }

  /* Editor */
  function field(label, key, opts = {}) {
    const wrap = document.createElement('label');
    wrap.className = 'f';
    wrap.append(document.createTextNode(label));
    const input = document.createElement(opts.area ? 'textarea' : 'input');
    input.className = 'field';
    if (!opts.area) input.type = opts.type || 'text';
    if (opts.area) input.rows = opts.rows || 3;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.autocomplete) input.autocomplete = opts.autocomplete;
    input.value = opts.get ? opts.get() : cv[key] || '';
    input.addEventListener('input', () => { opts.set ? opts.set(input.value) : (cv[key] = input.value); changed(); });
    wrap.append(input);
    if (opts.hint) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = opts.hint; wrap.append(h); }
    return wrap;
  }

  function entryList(key, title, addLabel) {
    const box = el(`list-${key}`);
    box.innerHTML = '';
    cv[key].forEach((e, i) => {
      const card = document.createElement('details');
      card.className = 'entry-card';
      card.open = !hasEntry(e) || cv[key].length === 1;
      const sum = document.createElement('summary');
      const name = document.createElement('span');
      name.className = 'entry-name';
      const refresh = () => { name.textContent = [e.title, e.org].filter(Boolean).join(', ') || `New ${title.toLowerCase()} entry`; };
      refresh();
      const dates = document.createElement('span'); dates.className = 'entry-when'; dates.textContent = e.dates || '';
      sum.append(name, dates);
      card.append(sum);
      const grid = document.createElement('div'); grid.className = 'entry-fields';
      const bind = (label, prop, extra = {}) => field(label, null, { ...extra, get: () => e[prop], set: v => { e[prop] = v; refresh(); dates.textContent = e.dates || ''; } });
      grid.append(
        bind('Title', 'title', { placeholder: 'Claims Handler' }),
        bind('Organisation', 'org', { placeholder: 'If P&C Insurance' }),
        bind('Dates', 'dates', { placeholder: '2024–present' }),
        bind('Bullet points', 'bullets', { area: true, rows: 3, hint: 'One per line.' })
      );
      const actions = document.createElement('div'); actions.className = 'entry-actions';
      const btn = (text, fn, disabled) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-quiet'; b.textContent = text; b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
      actions.append(
        btn('Move up', () => { [cv[key][i - 1], cv[key][i]] = [cv[key][i], cv[key][i - 1]]; entryList(key, title, addLabel); changed(); }, i === 0),
        btn('Move down', () => { [cv[key][i + 1], cv[key][i]] = [cv[key][i], cv[key][i + 1]]; entryList(key, title, addLabel); changed(); }, i === cv[key].length - 1),
        btn('Remove', () => { cv[key].splice(i, 1); entryList(key, title, addLabel); changed(); })
      );
      grid.append(actions);
      card.append(grid);
      box.append(card);
    });
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'btn'; add.textContent = addLabel;
    add.addEventListener('click', () => { cv[key].push(blankEntry()); entryList(key, title, addLabel); changed(); const cards = box.querySelectorAll('.entry-card'); const last = cards[cards.length - 1]; last.open = true; last.querySelector('input')?.focus(); });
    box.append(add);
  }

  function renderEditor() {
    const d = el('f-details'); d.innerHTML = '';
    d.append(
      field('Full name', 'name', { autocomplete: 'name' }),
      field('Location', 'location', { placeholder: 'Oslo', autocomplete: 'address-level2' }),
      field('Phone', 'phone', { type: 'tel', autocomplete: 'tel' }),
      field('Email', 'email', { type: 'email', autocomplete: 'email' }),
      field('LinkedIn', 'linkedin', { placeholder: 'linkedin.com/in/your-name', autocomplete: 'url' })
    );
    const s = el('f-summary'); s.innerHTML = '';
    s.append(field('Short summary', 'summary', { area: true, rows: 4, hint: 'Two or three sentences about what you bring.' }));
    entryList('education', 'Education', 'Add education');
    entryList('experience', 'Work experience', 'Add job');
    entryList('roles', 'Role', 'Add role');
    const c = el('f-courses'); c.innerHTML = '';
    c.append(field('Courses', 'courses', { area: true, rows: 2, hint: 'One per line. Shown as a single line on the CV.' }));
    const k = el('f-skills'); k.innerHTML = '';
    k.append(
      field('Data skills', 'dataSkills', { area: true, rows: 3, hint: 'One per line.' }),
      field('Competencies', 'competencies'),
      field('Languages', 'languages', { placeholder: 'Norwegian (native) · English (fluent)' }),
      field('References', 'references')
    );
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === cv.lang)));
  }

  /* Preview */
  function renderPreview() {
    const L = LABELS[cv.lang] || LABELS.en;
    const sec = t => `<h2 class="cv-h">${esc(t)}</h2>`;
    const ent = e => `<div class="cv-entry"><p class="cv-eh"><span class="cv-et">${esc(e.title)}${e.title && e.org ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : ''}${esc(e.org)}</span><span class="cv-ed">${esc(e.dates)}</span></p>${lines(e.bullets).length ? `<ul class="cv-ul">${lines(e.bullets).map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
    const contact = [cv.location, cv.phone, cv.email].filter(Boolean).map(esc);
    if (cv.linkedin) contact.push(`<a href="${esc(linkUrl(cv.linkedin))}">${esc(linkText(cv.linkedin))}</a>`);
    let h = `<p class="cv-name">${esc(cv.name || 'Your name')}</p><p class="cv-contact">${contact.join('<span class="cv-dot">·</span>')}</p>`;
    if (cv.summary) h += sec(L.summary) + `<p class="cv-p">${esc(cv.summary)}</p>`;
    const edu = cv.education.filter(hasEntry), exp = cv.experience.filter(hasEntry), roles = cv.roles.filter(hasEntry), courses = lines(cv.courses);
    if (edu.length) h += sec(L.education) + edu.map(ent).join('');
    if (exp.length) h += sec(L.experience) + exp.map(ent).join('');
    if (roles.length || courses.length) h += sec(L.roles) + roles.map(ent).join('') + (courses.length ? `<p class="cv-courses">${esc(L.courses)}: ${courses.map(esc).join(' · ')}</p>` : '');
    const ds = lines(cv.dataSkills);
    if (ds.length || cv.competencies || cv.languages) {
      h += sec(L.skills) + `<div class="cv-cols"><div>${ds.length ? `<p class="cv-sub">${esc(L.dataSkills)}</p>${ds.map(x => `<p class="cv-line">${esc(x)}</p>`).join('')}` : ''}</div><div>${cv.competencies ? `<p class="cv-sub">${esc(L.competencies)}</p><p class="cv-line">${esc(cv.competencies)}</p>` : ''}${cv.languages ? `<p class="cv-sub">${esc(L.languages)}</p><p class="cv-line">${esc(cv.languages)}</p>` : ''}</div></div>`;
    }
    if (cv.references) h += sec(L.references) + `<p class="cv-p">${esc(cv.references)}</p>`;
    el('cv-content').innerHTML = h;
    el('cv-page').setAttribute('lang', cv.lang === 'no' ? 'no' : 'en');
    fit();
  }

  // Scale the A4 page to the available width and check that it fits on one page
  function fit() {
    const page = el('cv-page'), stage = el('cv-stage'), content = el('cv-content');
    const scale = Math.min(1, stage.clientWidth / page.offsetWidth);
    page.style.transform = `scale(${scale})`;
    stage.style.height = `${page.offsetHeight * scale}px`;
    const over = content.scrollHeight - content.clientHeight;
    const status = el('fit');
    status.classList.toggle('over', over > 1);
    status.textContent = over > 1
      ? `About ${Math.ceil(over / (content.clientHeight / 52))} lines too long for one page. Shorten a bullet point or remove an entry.`
      : 'Fits on one page.';
  }

  let queued = false;
  function changed() {
    save();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderPreview(); });
  }

  /* Downloads */
  let docxLoading = null;
  function loadDocx() {
    if (window.docx) return Promise.resolve(window.docx);
    docxLoading = docxLoading || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/docx.min.js';
      s.onload = () => resolve(window.docx);
      s.onerror = () => { docxLoading = null; reject(new Error('Could not load the Word library.')); };
      document.head.append(s);
    });
    return docxLoading;
  }
  const fileName = ext => `CV${cv.name ? ' - ' + cv.name.replace(/[\\/:*?"<>|]/g, '') : ''}.${ext}`;
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  el('dl-word').addEventListener('click', async e => {
    const b = e.currentTarget, label = b.textContent;
    b.disabled = true; b.textContent = 'Preparing…';
    try { const D = await loadDocx(); download(await D.Packer.toBlob(buildDocx(D, cv)), fileName('docx')); }
    catch (err) { alert(err.message); }
    finally { b.disabled = false; b.textContent = label; }
  });
  el('dl-pdf').addEventListener('click', () => { document.title = fileName('pdf').replace(/\.pdf$/, ''); window.print(); });
  el('save-file').addEventListener('click', () => download(new Blob([JSON.stringify(cv, null, 2)], { type: 'application/json' }), fileName('json')));
  el('open-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { cv = { ...clone(EMPTY), ...JSON.parse(await f.text()) }; renderEditor(); changed(); }
    catch (err) { alert('That file could not be read. Choose a file saved from this page.'); }
    e.target.value = '';
  });
  el('load-example').addEventListener('click', () => { cv = clone(EXAMPLE); renderEditor(); changed(); });
  el('clear').addEventListener('click', () => { if (confirm('Clear everything you have entered?')) { cv = clone(EMPTY); renderEditor(); changed(); } });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { cv.lang = b.dataset.lang; renderEditor(); changed(); }));

  // Edit / Preview tabs on narrow screens
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    document.body.dataset.view = b.dataset.view;
    document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (b.dataset.view === 'preview') fit();
    window.scrollTo({ top: el('tool').offsetTop - 64 });
  }));

  // Enter in a field should not submit and reload the page
  document.querySelector('.editor').addEventListener('submit', e => e.preventDefault());
  new ResizeObserver(() => fit()).observe(el('cv-stage'));
  if (document.fonts) document.fonts.ready.then(fit);
  renderEditor();
  renderPreview();
}
