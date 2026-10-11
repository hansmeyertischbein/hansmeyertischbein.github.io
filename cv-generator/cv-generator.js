// CV generator: a one-page CV with navy headings, right-aligned dates and bullet points.
// Live preview in HTML, download as Word (docx) or PDF (jsPDF). Upload a CV as PDF, Word,
// text or JSON and it is read into the form. Everything runs in the browser.

/* ---------- Content model ---------- */

const LABELS = {
  en: {
    summary: 'Key qualifications', education: 'Education', experience: 'Work experience',
    roles: 'Organizational roles and courses', courses: 'Courses',
    skills: 'Data skills, competencies and languages', dataSkills: 'Data Skills',
    competencies: 'Competencies', languages: 'Languages', references: 'References', present: 'present'
  },
  no: {
    summary: 'Nøkkelkompetanse', education: 'Utdanning', experience: 'Arbeidserfaring',
    roles: 'Verv og kurs', courses: 'Kurs',
    skills: 'Datakunnskaper, ferdigheter og språk', dataSkills: 'Datakunnskaper',
    competencies: 'Ferdigheter', languages: 'Språk', references: 'Referanser', present: 'nå'
  }
};

const EXAMPLE = {
  lang: 'en',
  name: 'Sara Nilsen',
  location: 'Bergen',
  phone: '+47 900 00 000',
  email: 'sara.nilsen@example.com',
  linkedin: 'linkedin.com/in/sara-nilsen',
  summary: 'Marketing graduate who turns customer insight into campaigns that can be measured. Experience from retail, a student newspaper and a summer job in digital marketing.',
  education: [
    { title: 'Master in Marketing and Brand Management', org: 'University of Bergen', dates: '2025–2027', bullets: 'Thesis on how loyalty programmes change shopping habits' },
    { title: 'Bachelor in Media and Communication', org: 'University of Agder', dates: '2022–2025', bullets: 'Exchange semester at Lund University, Sweden' }
  ],
  experience: [
    { title: 'Digital Marketing Assistant, Summer', org: 'Fjord Outdoor AS', dates: '2025', bullets: 'Planned and ran paid social campaigns for the summer season with a budget of NOK 150,000\nWrote a weekly report on reach, clicks and sales for the marketing manager' },
    { title: 'Store Employee, Part-time', org: 'Bokhuset Bergen', dates: '2022–present', bullets: 'Customer service, displays and stock management for a shop with 40,000 titles\nTrained four new employees' }
  ],
  roles: [
    { title: 'Editor', org: 'Student newspaper', dates: '2023–2024', bullets: 'Led a team of twelve writers and photographers' }
  ],
  courses: 'Google Analytics Certification\nCopywriting for the web',
  dataSkills: 'Google Analytics, Meta Ads Manager\nCanva, Figma\nExcel',
  competencies: 'Campaign planning, copywriting, customer insight',
  languages: 'Norwegian (native) · English (fluent) · Swedish (good)',
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
const MIN_SCALE = 0.85;

/* ---------- Word document (also runs in Node for testing) ---------- */

// s scales text and spacing, so the Word file matches the one-page preview
function buildDocx(D, cv, s = 1) {
  const L = LABELS[cv.lang] || LABELS.en;
  const NAVY = '1F3864', INK = '111111', GREY = '333333', LINK = '1155CC', FONT = 'Calibri';
  const PAGE_W = 11906, MARGIN_X = 800, WIDTH = PAGE_W - 2 * MARGIN_X;
  const sz = pt => Math.round(pt * s * 2);
  const sp = tw => Math.round(tw * s);
  const run = (text, o = {}) => new D.TextRun({ text, font: FONT, size: sz(o.size || 10), color: o.color || INK, bold: !!o.bold, italics: !!o.italics, characterSpacing: o.spacing ? sp(o.spacing) : undefined });

  const heading = title => new D.Paragraph({
    children: [run(title.toUpperCase(), { bold: true, color: NAVY, size: 10, spacing: 10 })],
    spacing: { before: sp(140), after: sp(70) }, keepNext: true,
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: NAVY, space: 2 } }
  });
  const bullet = text => new D.Paragraph({ numbering: { reference: 'cv-bullets', level: 0 }, children: [run(text)], spacing: { after: 0 } });
  const entry = e => {
    const head = [run(e.title || '', { bold: true, size: 10.5 })];
    if (e.title && e.org) head.push(run('  |  ', { bold: true, size: 10.5 }));
    if (e.org) head.push(run(e.org, { bold: true, size: 10.5 }));
    if (e.dates) head.push(new D.TextRun({ children: [new D.Tab(), e.dates], font: FONT, size: sz(10), italics: true, color: GREY }));
    return [
      new D.Paragraph({ children: head, tabStops: [{ type: D.TabStopType.RIGHT, position: WIDTH }], spacing: { before: sp(60), after: sp(10) }, keepNext: lines(e.bullets).length > 0 }),
      ...lines(e.bullets).map(bullet)
    ];
  };

  const body = [];
  body.push(new D.Paragraph({ children: [run((cv.name || '').toUpperCase(), { bold: true, color: NAVY, size: 17 })], spacing: { after: sp(20) } }));

  const contact = [];
  const sep = () => run('   ·   ', { size: 9, color: GREY });
  [cv.location, cv.phone, cv.email].filter(Boolean).forEach(t => { if (contact.length) contact.push(sep()); contact.push(run(t, { size: 9, color: GREY })); });
  if (cv.linkedin) {
    if (contact.length) contact.push(sep());
    contact.push(new D.ExternalHyperlink({ link: linkUrl(cv.linkedin), children: [new D.TextRun({ text: linkText(cv.linkedin), font: FONT, size: sz(9), color: LINK, underline: {} })] }));
  }
  body.push(new D.Paragraph({ children: contact, spacing: { after: sp(80) }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } } }));

  if (cv.summary) { body.push(heading(L.summary), new D.Paragraph({ children: [run(cv.summary)], spacing: { after: sp(40) } })); }
  const list = (key, label) => { const items = (cv[key] || []).filter(hasEntry); if (items.length) { body.push(heading(label)); items.forEach(e => body.push(...entry(e))); } };
  list('education', L.education);
  list('experience', L.experience);

  const roles = (cv.roles || []).filter(hasEntry), courses = lines(cv.courses);
  if (roles.length || courses.length) {
    body.push(heading(L.roles));
    roles.forEach(e => body.push(...entry(e)));
    if (courses.length) body.push(new D.Paragraph({ children: [run(`${L.courses}: ${courses.join(' · ')}`, { size: 9.5 })], spacing: { before: sp(40) } }));
  }

  const ds = lines(cv.dataSkills);
  if (ds.length || cv.competencies || cv.languages) {
    body.push(heading(L.skills));
    const sub = t => new D.Paragraph({ children: [run(t, { bold: true, color: NAVY })], spacing: { after: sp(20) } });
    const p = t => new D.Paragraph({ children: [run(t)], spacing: { after: sp(20) } });
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
    creator: cv.name || 'CV',
    title: cv.name ? `CV – ${cv.name}` : 'CV',
    styles: { default: { document: { run: { font: FONT, size: sz(10), color: INK } } } },
    numbering: { config: [{ reference: 'cv-bullets', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '●', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: sp(720), hanging: sp(360) } }, run: { size: sz(9) } } }] }] },
    sections: [{ properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 380, bottom: 400, left: MARGIN_X, right: MARGIN_X } } }, children: body }]
  });
}

/* ---------- PDF (jsPDF). Mirrors the preview's CSS. Returns the height used. ---------- */

function layoutPdf(doc, cv, s, draw) {
  const L = LABELS[cv.lang] || LABELS.en;
  const W = 595.28, H = 841.89, X0 = 40, X1 = W - 40, TOP = 19, BOTTOM = H - 20;
  const NAVY = [31, 56, 100], INK = [17, 17, 17], GREY = [51, 51, 51], LINK = [17, 85, 204];
  const F = 'CVSans';
  let y = TOP;
  const font = (style, size, color) => { doc.setFont(F, style); doc.setFontSize(size * s); doc.setTextColor(...(color || INK)); };
  const lh = (size, k = 1.22) => size * s * k;
  // baseline offset inside a line box: half-leading plus ascent (Carlito ascent ≈ 0.952 em, descent ≈ 0.269 em)
  const base = (size, k = 1.22) => size * s * ((k - 1.221) / 2 + 0.952);
  const text = (t, x, size, k, opts) => { if (draw) doc.text(t, x, y + base(size, k), opts || {}); };
  const rule = (width, color) => { if (draw) { doc.setDrawColor(...color); doc.setLineWidth(width); doc.line(X0, y, X1, y); } };
  const wrap = (t, width) => doc.splitTextToSize(String(t), width);
  const para = (t, size, style, color, x = X0, width = X1 - X0) => {
    font(style, size, color);
    wrap(t, width).forEach(line => { text(line, x, size, 1.22); y += lh(size); });
  };

  // name and contact line
  font('bold', 17, NAVY);
  text((cv.name || '').toUpperCase(), X0, 17, 1.15); y += lh(17, 1.15) + 1 * s;
  font('normal', 9, GREY);
  const items = [cv.location, cv.phone, cv.email].filter(Boolean).map(t => ({ t }));
  if (cv.linkedin) items.push({ t: linkText(cv.linkedin), url: linkUrl(cv.linkedin) });
  const dot = '  ·  ';
  let x = X0;
  const startY = y;
  items.forEach((it, i) => {
    if (i) { font('normal', 9, GREY); const dw = doc.getTextWidth(dot); if (x + dw > X1) { x = X0; y += lh(9); } text(dot, x, 9, 1.22); x += dw; }
    font('normal', 9, it.url ? LINK : GREY);
    const w = doc.getTextWidth(it.t);
    if (x + w > X1) { x = X0; y += lh(9); }
    text(it.t, x, 9, 1.22);
    if (draw && it.url) {
      doc.link(x, y, w, lh(9), { url: it.url });
      doc.setDrawColor(...LINK); doc.setLineWidth(0.5); doc.line(x, y + base(9) + 1.2 * s, x + w, y + base(9) + 1.2 * s);
    }
    x += w;
  });
  if (items.length || startY === y) y += lh(9);
  y += 5 * s; rule(1.5, NAVY); y += 0.75;

  const heading = t => {
    y += 8 * s;
    font('bold', 10, NAVY);
    text(t.toUpperCase(), X0, 10, 1.2, { charSpace: 0.5 * s });
    y += lh(10, 1.2) + 2 * s; rule(0.75, NAVY); y += 0.4 + 4 * s;
  };
  const entry = e => {
    y += 3 * s;
    font('italic', 10, GREY);
    const dw = e.dates ? doc.getTextWidth(e.dates) : 0;
    font('bold', 10.5);
    const head = [e.title, e.org].filter(Boolean).join('  |  ');
    const hl = wrap(head, X1 - X0 - (dw ? dw + 12 * s : 0));
    const k = 1.22;
    hl.forEach((line, i) => {
      font('bold', 10.5); text(line, X0, 10.5, k);
      if (i === 0 && e.dates) { font('italic', 10, GREY); text(e.dates, X1, 10.5, k, { align: 'right' }); }
      y += lh(10.5);
    });
    const bl = lines(e.bullets);
    if (bl.length) y += 1 * s;
    bl.forEach(b => {
      font('normal', 10);
      const ls = wrap(b, X1 - X0 - 36 * s);
      if (draw) { doc.setFillColor(...INK); doc.circle(X0 + 36 * s - 16.2 * s + 2.1 * s, y + 4.7 * s + 2.1 * s, 2.1 * s, 'F'); }
      ls.forEach(line => { text(line, X0 + 36 * s, 10, 1.22); y += lh(10); });
    });
  };

  if (cv.summary) { heading(L.summary); para(cv.summary, 10, 'normal'); y += 2 * s; }
  const list = (key, label) => { const it = (cv[key] || []).filter(hasEntry); if (it.length) { heading(label); it.forEach(entry); } };
  list('education', L.education);
  list('experience', L.experience);
  const roles = (cv.roles || []).filter(hasEntry), courses = lines(cv.courses);
  if (roles.length || courses.length) {
    heading(L.roles);
    roles.forEach(entry);
    if (courses.length) { y += 2 * s; para(`${L.courses}: ${courses.join(' · ')}`, 9.5, 'normal'); }
  }
  const ds = lines(cv.dataSkills);
  if (ds.length || cv.competencies || cv.languages) {
    heading(L.skills);
    const colW = (X1 - X0 - 10 * s - 10 * s) / 2, cx = [X0 + 5 * s, X0 + 5 * s + colW + 10 * s];
    const top = y; let yl = top, yr = top;
    const col = (blocks, cxi) => {
      y = top;
      blocks.forEach(b => {
        y += 1 * s; para(b.title, 10, 'bold', NAVY, cx[cxi], colW); y += 1 * s;
        b.lines.forEach(t => { para(t, 10, 'normal', INK, cx[cxi], colW); y += 1 * s; });
      });
      return y;
    };
    if (ds.length) yl = col([{ title: L.dataSkills, lines: ds }], 0);
    const right = [];
    if (cv.competencies) right.push({ title: L.competencies, lines: [cv.competencies] });
    if (cv.languages) right.push({ title: L.languages, lines: [cv.languages] });
    if (right.length) yr = col(right, 1);
    y = Math.max(yl, yr);
  }
  if (cv.references) { heading(L.references); para(cv.references, 10, 'normal'); }
  return { height: y, fits: y <= BOTTOM + 0.5 };
}

/* ---------- Reading an uploaded CV ---------- */

const SECTION_WORDS = {
  summary: ['summary', 'profile', 'about me', 'key qualifications', 'personal profile', 'professional summary', 'objective', 'profil', 'om meg', 'nøkkelkompetanse', 'nøkkelkvalifikasjoner', 'sammendrag', 'kvalifikasjoner'],
  education: ['education', 'academic background', 'utdanning', 'utdannelse'],
  experience: ['work experience', 'experience', 'professional experience', 'employment', 'employment history', 'career', 'arbeidserfaring', 'erfaring', 'yrkeserfaring', 'relevant erfaring', 'jobberfaring'],
  roles: ['organizational roles', 'organisational roles', 'organizational roles and courses', 'positions of trust', 'volunteering', 'volunteer work', 'extracurricular', 'extracurricular activities', 'leadership', 'verv', 'verv og kurs', 'frivillig arbeid', 'tillitsverv', 'annen erfaring', 'other experience'],
  courses: ['courses', 'certifications', 'certificates', 'courses and certifications', 'kurs', 'sertifiseringer', 'kurs og sertifiseringer'],
  skills: ['skills', 'data skills', 'it skills', 'technical skills', 'computer skills', 'competencies', 'skills and languages', 'data skills, competencies and languages', 'ferdigheter', 'datakunnskaper', 'kompetanse', 'it-kunnskaper', 'datakunnskaper, ferdigheter og språk', 'ferdigheter og språk'],
  languages: ['languages', 'language skills', 'språk', 'språkkunnskaper'],
  references: ['references', 'referees', 'referanser', 'referenser'],
  interests: ['interests', 'hobbies', 'interesser', 'fritid']
};
const MONTH = '(?:jan|feb|mar|apr|may|mai|jun|jul|aug|sep|sept|oct|okt|nov|dec|des)[a-z]*\\.?';
const YEAR = '(?:19|20)\\d{2}';
const POINT = `(?:(?:${MONTH}\\s*)?${YEAR}|\\d{1,2}[./]${YEAR})`;
const NOW = '(?:present|now|today|current|ongoing|nå|dd|d\\.d\\.|pågående|i dag|nåværende)';
const DATE_RE = new RegExp(`(${POINT}(?:\\s*(?:[–—-]|to|til)\\s*(?:${POINT}|${NOW}))?)\\s*$`, 'i');
const ONLY_DATE_RE = new RegExp(`^\\(?${POINT}(?:\\s*(?:[–—-]|to|til)\\s*(?:${POINT}|${NOW}))?\\)?$`, 'i');
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,11}\d?/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w\-%]+\/?/i;
const BULLET_RE = /^\s*(?:[•●▪◦‣∙·*•]\s*|[-–]\s+|o\s+(?=[A-ZÆØÅ]))/;

const norm = s => s.toLowerCase().replace(/[:.]+$/, '').replace(/\s+/g, ' ').trim();
function sectionOf(line) {
  const n = norm(line);
  if (!n || n.length > 60) return null;
  for (const [k, words] of Object.entries(SECTION_WORDS)) if (words.includes(n)) return k;
  // all-caps headings such as "WORK EXPERIENCE AND INTERNSHIPS"
  if (line === line.toUpperCase() && /[A-ZÆØÅ]/.test(line) && line.split(' ').length <= 7) {
    for (const [k, words] of Object.entries(SECTION_WORDS)) if (words.some(w => n.startsWith(w))) return k;
  }
  return null;
}

function tidyDates(d, lang) {
  return d.replace(/\s*(?:[–—-]|to|til)\s*/i, '–')
    .replace(new RegExp(`${NOW}$`, 'i'), lang === 'no' ? 'nå' : 'present')
    .replace(/^\(|\)$/g, '').trim();
}
function tidyBullet(t) {
  t = t.replace(BULLET_RE, '').replace(/\s+/g, ' ').trim().replace(/[.;]$/, '');
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
function splitHead(t) {
  for (const sep of [' | ', ' – ', ' — ', ' - ', ', ', ' at ', ' hos ', ' ved ']) {
    const i = t.indexOf(sep);
    if (i > 0) return { title: t.slice(0, i).trim(), org: t.slice(i + sep.length).trim() };
  }
  return { title: t.trim(), org: '' };
}

function parseCv(rawLines) {
  const cv = clone(EMPTY); cv.education = []; cv.experience = []; cv.roles = [];
  const unplaced = [];
  const all = rawLines.map(l => ({ ...l, text: String(l.text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() }))
    .map(l => ({ ...l, bullet: !!l.bullet || BULLET_RE.test(l.text) }))
    .filter(l => l.text && !/^(page|side)\s*\d+(\s*(of|av)\s*\d+)?$/i.test(l.text) && !/^\d+\s*(\/|of|av)\s*\d+$/.test(l.text));
  const xs = all.filter(l => l.x != null).map(l => l.x);
  const minX = xs.length ? Math.min(...xs) : null;
  const indented = l => l.x != null && minX != null && l.x - minX > 10;
  const rightCol = l => l.x != null && l.pageW && l.x > l.pageW * 0.45;

  // language
  const joined = all.map(l => l.text).join(' ').toLowerCase();
  const noHits = (joined.match(/\b(og|jeg|som|med|på|av|ansvar|erfaring|utdanning|ikke)\b/g) || []).length;
  const enHits = (joined.match(/\b(and|the|with|of|experience|education|responsible|in)\b/g) || []).length;
  cv.lang = noHits > enHits ? 'no' : 'en';

  // contact details, wherever they are
  const rest = [];
  all.forEach(l => {
    let t = l.text, found = false;
    const em = t.match(EMAIL_RE); if (em) { if (!cv.email) cv.email = em[0]; t = t.replace(em[0], ' '); found = true; }
    const li = t.match(LINKEDIN_RE); if (li) { if (!cv.linkedin) cv.linkedin = linkText(li[0]); t = t.replace(li[0], ' '); found = true; }
    if (found || /(\+\d{2}|tlf|phone|mobil|telefon)/i.test(t)) {
      const ph = t.match(PHONE_RE);
      if (ph && ph[0].replace(/\D/g, '').length >= 8) { if (!cv.phone) cv.phone = ph[0].trim(); t = t.replace(ph[0], ' '); found = true; }
    }
    if (found) {
      const left = t.replace(/(tlf|phone|mobil|telefon|e-?post|email|e-mail|linkedin)\.?:?/ig, ' ').split(/[|·•,;\t]| {3,}/).map(x => x.trim()).filter(x => x && /[a-zæøå]/i.test(x) && !/\d{3}/.test(x));
      if (left.length && !cv.location && left[0].split(' ').length <= 4) cv.location = left[0];
      return;
    }
    rest.push(l);
  });

  // name: the first short line, before any heading
  let i = 0;
  for (; i < rest.length && i < 4; i++) {
    const t = rest[i].text;
    if (sectionOf(t)) break;
    if (!cv.name && !/\d/.test(t) && t.split(' ').length <= 5 && !rest[i].bullet) { cv.name = t.replace(/\b([A-ZÆØÅ])([A-ZÆØÅ]+)\b/g, (m, a, b) => a + b.toLowerCase()); continue; }
    if (cv.name && !cv.location && t.split(' ').length <= 3 && !/\d/.test(t)) { cv.location = t; continue; }
    break;
  }

  let sec = 'summary', cur = null, last = null, lastText = '', lastIsBullet = false;
  const subs = { L: null, R: null }, colLast = { L: null, R: null };
  const summary = [], courseText = [], dataSkills = [], comps = [], langs = [], refs = [];
  const listSecs = { education: 1, experience: 1, roles: 1 };
  const continues = l => !l.bullet && (/^[a-zæøå(&]/.test(l.text) || /[,·;:–(&]$|\band$|\bog$/.test(lastText) || (lastIsBullet && indented(l)));
  const target = (fn, text, isBullet) => { last = fn; lastText = text; lastIsBullet = !!isBullet; };
  const newEntry = text => {
    const m = text.match(DATE_RE);
    let dates = '', head = text;
    if (m) { dates = tidyDates(m[1], cv.lang); head = text.slice(0, m.index).replace(/[\s|,–—-]+$/, ''); }
    const e = { ...splitHead(head), dates, bullets: '' };
    cv[sec].push(e); cur = e;
    target(t => { e.title += ' ' + t; }, head, false);
  };
  const addBullet = text => {
    if (!cur) newEntry('');
    const e = cur;
    e.bullets += (e.bullets ? '\n' : '') + tidyBullet(text);
    target(t => { e.bullets = e.bullets + ' ' + t.replace(BULLET_RE, '').trim().replace(/[.;]$/, ''); }, text, true);
  };
  const pushTo = (arr, text) => { arr.push(text); target(t => { const k = arr.length - 1; arr[k] = (arr[k].replace(/\s*[·,]$/, m => m.trim()) + ' ' + t).trim(); }, text, false); };

  for (; i < rest.length; i++) {
    const l = rest[i], text = l.text, bullet = l.bullet;
    if (sec === 'skills') {
      const col = rightCol(l) ? 'R' : 'L', n = norm(text);
      const sub = /^(data skills|it skills|technical skills|computer skills|datakunnskaper|it-kunnskaper|digitale ferdigheter)$/.test(n) ? 'data'
        : /^(competencies|skills|key skills|ferdigheter|kompetanse)$/.test(n) ? 'comp'
        : /^(languages|language skills|språk|språkkunnskaper)$/.test(n) ? 'languages' : null;
      if (sub) { subs[col] = sub; colLast[col] = null; continue; }
      if (!sectionOf(text)) {
        const t = text.replace(BULLET_RE, '');
        const prev = colLast[col];
        if (prev && !bullet && (/^[a-zæøå(&]/.test(t) || /[,·;:–(&]$|\band$|\bog$/.test(prev.text))) { prev.add(t); prev.text = t; continue; }
        const isLang = /\b(norwegian|english|german|spanish|french|swedish|danish|norsk|engelsk|tysk|spansk|fransk|svensk|dansk)\b/i.test(t) && /(native|fluent|basic|good|morsmål|flytende|grunnleggende|god|gode)/i.test(t);
        const arr = subs[col] === 'languages' || isLang ? langs : subs[col] === 'comp' ? comps : dataSkills;
        arr.push(t);
        const k = arr.length - 1;
        colLast[col] = { text: t, add: x => { arr[k] = (arr[k] + ' ' + x).trim(); } };
        continue;
      }
    }
    const s2 = !bullet && sectionOf(text);
    if (s2) {
      sec = s2 === 'languages' ? 'skills' : s2; cur = null; last = null; lastText = '';
      subs.L = subs.R = s2 === 'languages' ? 'languages' : null; colLast.L = colLast.R = null;
      continue;
    }
    if (last && continues(l) && !(listSecs[sec] && ONLY_DATE_RE.test(text))) {
      last(text.replace(BULLET_RE, '')); lastText = text; continue;
    }
    if (listSecs[sec]) {
      if (!bullet && ONLY_DATE_RE.test(text)) { if (cur && !cur.dates) cur.dates = tidyDates(text, cv.lang); continue; }
      if (/^(courses|kurs)\s*:/i.test(text)) { pushTo(courseText, text.replace(/^[^:]+:\s*/, '')); continue; }
      if (bullet) { addBullet(text); continue; }
      // organisation on its own line under a title
      if (cur && !cur.org && !cur.bullets && !DATE_RE.test(text) && text.split(' ').length <= 8 && !/[.]$/.test(text)) { cur.org = text; target(t => { cur.org += ' ' + t; }, text, false); continue; }
      // a line with "|" or followed by a date on its own line starts a new entry
      const next = rest[i + 1];
      if (text.includes(' | ') || (next && !next.bullet && ONLY_DATE_RE.test(next.text))) { newEntry(text); continue; }
      // a sentence under an entry without a bullet sign is a bullet point
      if (cur && !DATE_RE.test(text) && (text.split(' ').length > 8 || /[.]$/.test(text) || indented(l))) { addBullet(text); continue; }
      newEntry(text);
      continue;
    }
    if (sec === 'summary') { pushTo(summary, text.replace(BULLET_RE, '')); continue; }
    if (sec === 'courses') { pushTo(courseText, text.replace(BULLET_RE, '')); continue; }
    if (sec === 'references') { pushTo(refs, text); continue; }
    if (sec === 'interests') { unplaced.push(text); continue; }
    unplaced.push(text);
  }
  cv.summary = summary.join(' ');
  cv.courses = courseText.join(' ').split(/\s*[·;•]\s*/).map(x => x.trim()).filter(Boolean).join('\n');
  cv.dataSkills = dataSkills.join('\n');
  cv.competencies = comps.join(' ').replace(/\s+,/g, ',');
  cv.languages = langs.map(x => x.replace(/\s*·\s*$/, '')).join(' · ').replace(/\s+·/g, ' ·');
  cv.references = refs.join(' ');
  ['education', 'experience', 'roles'].forEach(k => {
    cv[k] = cv[k].filter(hasEntry);
    cv[k].forEach(e => { e.title = e.title.trim(); if (!e.title && e.org) { e.title = e.org; e.org = ''; } });
  });
  if (!cv.education.length) cv.education = [blankEntry()];
  if (!cv.experience.length) cv.experience = [blankEntry()];
  return { cv, unplaced };
}

/* ---------- Writing checks ---------- */

const WEAK = {
  en: [[/^(was )?responsible for\b/i, 'Led, Managed or Ran'], [/^(worked|working) (with|on)\b/i, 'a verb for what you did: Built, Analysed, Sold'], [/^helped\b/i, 'what you did yourself: Prepared, Organised'], [/^assisted\b/i, 'Supported, Prepared, Carried out'], [/^participated in\b/i, 'your part: Presented, Delivered'], [/^involved in\b/i, 'your part: Built, Planned'], [/^tasks included\b/i, 'one bullet per result']],
  no: [[/^(hadde )?ansvar(lig)? for\b/i, 'Ledet, Styrte eller Drev'], [/^jobbet (med|på)\b/i, 'et verb for hva du gjorde: Bygde, Analyserte, Solgte'], [/^hjalp\b/i, 'det du gjorde selv: Forberedte, Organiserte'], [/^bisto\b/i, 'Støttet, Forberedte, Gjennomførte'], [/^deltok i\b/i, 'din del: Presenterte, Leverte'], [/^arbeidsoppgaver\b/i, 'ett punkt per resultat']]
};
const NUM_EN = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundreds?|thousands?|dozens?|million|half|double|tripled?)\b/i;
const NUM_NO = /\b(to|tre|fire|fem|seks|sju|syv|åtte|ni|ti|elleve|tolv|femten|tjue|tretti|femti|hundre|hundrevis|tusen|tusenvis|million|halvparten|dobl\w*|tredobl\w*)\b/i;
function checkCv(cv) {
  const out = [], en = cv.lang !== 'no';
  const T = en
    ? { num: 'Add a number: how many, how much, how often or how fast', long: 'Shorten to about 20 words', first: 'Drop "I": start with the verb', weak: v => `Start with a stronger verb, for example ${v}`, ph: 'Fill in the placeholder', many: 'Keep the three or four strongest bullet points', date: 'Add dates', sum: 'Cut the summary to two or three sentences', sumI: 'Write the summary without "I"' }
    : { num: 'Legg til et tall: hvor mange, hvor mye, hvor ofte eller hvor raskt', long: 'Kort ned til rundt 20 ord', first: 'Dropp «jeg»: begynn med verbet', weak: v => `Begynn med et sterkere verb, for eksempel ${v}`, ph: 'Fyll inn plassholderen', many: 'Behold de tre eller fire sterkeste punktene', date: 'Legg til datoer', sum: 'Kort sammendraget ned til to eller tre setninger', sumI: 'Skriv sammendraget uten «jeg»' };
  const words = t => t.split(/\s+/).filter(Boolean).length;
  if (cv.summary) {
    if (words(cv.summary) > 60) out.push({ where: 'summary', what: T.sum, quote: cv.summary.slice(0, 80) + '…' });
    if (/\b(I|jeg)\b/.test(cv.summary) && (cv.summary.match(/\b(I|jeg)\b/g) || []).length > 1) out.push({ where: 'summary', what: T.sumI, quote: '' });
  }
  ['experience', 'roles', 'education'].forEach(key => {
    (cv[key] || []).forEach((e, ei) => {
      if (!hasEntry(e)) return;
      const name = [e.title, e.org].filter(Boolean).join(', ');
      if (!e.dates) out.push({ where: key, ei, name, what: T.date, quote: '' });
      const bl = lines(e.bullets);
      if (bl.length > 5 && key !== 'education') out.push({ where: key, ei, name, what: T.many, quote: `${bl.length} bullet points` });
      bl.forEach(b => {
        if (/\[[^\]]*\]/.test(b)) out.push({ where: key, ei, name, what: T.ph, quote: b });
        if (/^(I|Jeg)\b/.test(b)) out.push({ where: key, ei, name, what: T.first, quote: b });
        const w = (WEAK[cv.lang] || WEAK.en).find(([re]) => re.test(b));
        if (w) out.push({ where: key, ei, name, what: T.weak(w[1]), quote: b });
        if (words(b) > 25) out.push({ where: key, ei, name, what: T.long, quote: b });
        if (key !== 'education' && !/\d/.test(b) && !(en ? NUM_EN : NUM_NO).test(b)) out.push({ where: key, ei, name, what: T.num, quote: b, kind: 'num' });
      });
    });
  });
  const rank = o => (o.what === T.ph ? 0 : o.kind === 'num' ? 2 : 1);
  return out.sort((x, y) => rank(x) - rank(y));
}

function aiPrompt(cv) {
  const no = cv.lang === 'no';
  const rules = [
    'Rewrite the CV below to be stronger, in the same language as the CV (' + (no ? 'Norwegian' : 'English') + ').',
    'Rules:',
    '- Never invent facts, employers, dates, results or numbers. Only use what is in the CV.',
    '- Where a number would make a bullet stronger but the CV has none, write [add number] (or [legg til tall] in Norwegian) so the person can fill it in.',
    '- Each bullet starts with a strong verb in the past tense (present tense for a current job), no "I", no full stop at the end, at most about 20 words.',
    '- Lead with results and scale: amounts in NOK, percentages, team sizes, customer numbers, time frames ("in under six months").',
    '- Two to four bullets per job, the most relevant first. Merge or drop weak ones.',
    '- Summary: two or three sentences on what the person brings, no clichés, no "I".',
    '- Keep titles and organisation names as they are. Dates like 2023–2026 or 2024–present.',
    '- It must fit on one A4 page, so be brief.',
    '- Reply with JSON only, in exactly the same structure and keys as the input.',
    '',
    'CV as JSON:'
  ].join('\n');
  const data = { lang: cv.lang, name: cv.name, location: cv.location, phone: cv.phone, email: cv.email, linkedin: cv.linkedin, summary: cv.summary,
    education: cv.education.filter(hasEntry), experience: cv.experience.filter(hasEntry), roles: cv.roles.filter(hasEntry),
    courses: cv.courses, dataSkills: cv.dataSkills, competencies: cv.competencies, languages: cv.languages, references: cv.references };
  return rules + '\n' + JSON.stringify(data, null, 2);
}

function readJsonAnswer(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const d = JSON.parse(body);
  if (!d || typeof d !== 'object' || !('name' in d || 'experience' in d)) throw new Error('not a CV');
  const fixList = a => (Array.isArray(a) ? a : []).map(e => ({ title: e.title || '', org: e.org || '', dates: e.dates || '', bullets: Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.bullets || '') }));
  const out = { ...clone(EMPTY), ...d };
  ['education', 'experience', 'roles'].forEach(k => { out[k] = fixList(d[k]); });
  ['courses', 'dataSkills'].forEach(k => { if (Array.isArray(d[k])) out[k] = d[k].join('\n'); });
  if (!out.education.length) out.education = [blankEntry()];
  if (!out.experience.length) out.experience = [blankEntry()];
  return out;
}

if (typeof module !== 'undefined') module.exports = { buildDocx, layoutPdf, parseCv, checkCv, aiPrompt, readJsonAnswer, EXAMPLE, LABELS, EMPTY };

/* ---------- Browser ---------- */

if (typeof document !== 'undefined') {
  const STORE = 'cv-generator-v2';
  const el = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cv = load() || clone(EXAMPLE);
  let scale = 1;

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
    if (opts.id) input.id = opts.id;
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
      card.id = `card-${key}-${i}`;
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
        bind('Title', 'title', { placeholder: 'Job title or degree' }),
        bind('Organisation', 'org', { placeholder: 'Company or school' }),
        bind('Dates', 'dates', { placeholder: '2024–present' }),
        bind('Bullet points', 'bullets', { area: true, rows: Math.max(3, lines(e.bullets).length + 1), hint: 'One per line.' })
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
    s.append(field('Short summary', 'summary', { area: true, rows: 4, id: 'in-summary', hint: 'Two or three sentences about what you bring.' }));
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
    renderChecks();
  }

  // Scale the A4 page to the available width, then find the largest text size that fits on one page
  function fit() {
    const page = el('cv-page'), stage = el('cv-stage'), content = el('cv-content');
    const view = Math.min(1, stage.clientWidth / page.offsetWidth);
    page.style.transform = `scale(${view})`;
    stage.style.height = `${page.offsetHeight * view}px`;
    const over = () => content.scrollHeight - content.clientHeight > 1;
    page.style.setProperty('--s', '1');
    scale = 1;
    if (over()) {
      let lo = MIN_SCALE, hi = 1;
      page.style.setProperty('--s', String(lo));
      if (over()) { scale = lo; }
      else {
        for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; page.style.setProperty('--s', String(mid)); if (over()) hi = mid; else lo = mid; }
        scale = Math.floor(lo * 100) / 100;
        page.style.setProperty('--s', String(scale));
      }
    }
    const status = el('fit');
    const still = over();
    status.classList.toggle('over', still);
    if (still) {
      const extra = content.scrollHeight - content.clientHeight;
      status.textContent = `Too long for one page even with smaller text. Remove about ${Math.ceil(extra / (10 * scale * 1.22))} lines: shorten bullet points or drop an older entry.`;
    } else {
      status.textContent = scale < 1 ? `Fits on one page with the text at ${Math.round(scale * 100)}%.` : 'Fits on one page.';
    }
  }

  /* Writing checks */
  const SECTION_NAMES = { summary: 'Summary', education: 'Education', experience: 'Work experience', roles: 'Organisational roles' };
  function renderChecks() {
    const list = el('check-list'), out = checkCv(cv);
    list.textContent = '';
    const bullets = ['experience', 'roles'].reduce((n, k) => n + cv[k].reduce((m, e) => m + lines(e.bullets).length, 0), 0);
    const noNum = out.filter(o => o.kind === 'num').length;
    el('check-summary').textContent = !bullets && !cv.summary ? 'Fill in your experience and the checks appear here.'
      : out.length === 0 ? 'No suggestions. Every bullet point has a number and starts with a clear verb.'
      : `${bullets - noNum} of ${bullets} bullet points in experience and roles contain a number. ${out.length} suggestion${out.length === 1 ? '' : 's'}:`;
    out.slice(0, 12).forEach(o => {
      const li = document.createElement('li');
      const w = document.createElement('span'); w.className = 'where'; w.textContent = SECTION_NAMES[o.where] + (o.name ? ' · ' + o.name : '');
      const t = document.createElement('span'); t.className = 'what'; t.textContent = o.what;
      li.append(w, t);
      if (o.quote) { const q = document.createElement('span'); q.className = 'quote'; q.textContent = '“' + o.quote + '”'; li.append(q); }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-quiet'; b.textContent = 'Edit';
      b.addEventListener('click', () => goTo(o));
      li.append(b);
      list.append(li);
    });
    if (out.length > 12) { const li = document.createElement('li'); li.className = 'check-more'; li.textContent = `and ${out.length - 12} more.`; list.append(li); }
  }
  function goTo(o) {
    let target;
    if (o.where === 'summary') target = el('in-summary');
    else { const card = el(`card-${o.where}-${o.ei}`); if (card) { card.open = true; target = card.querySelector('textarea') || card.querySelector('input'); } }
    if (!target) return;
    document.body.dataset.view = 'edit';
    document.querySelectorAll('.view-tabs [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.view === 'edit')));
    target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
    if (o.quote && target.tagName === 'TEXTAREA') { const i = target.value.indexOf(o.quote); if (i >= 0) target.setSelectionRange(i, i + o.quote.length); }
    target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
  }

  let queued = false;
  function changed() {
    save();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderPreview(); });
  }

  /* Libraries, loaded only when needed */
  const loaded = {};
  function script(src) {
    loaded[src] = loaded[src] || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => { delete loaded[src]; reject(new Error('Could not load a part of the page. Check your connection and try again.')); };
      document.head.append(s);
    });
    return loaded[src];
  }

  /* Downloads */
  const fileName = ext => `CV${cv.name ? ' - ' + cv.name.replace(/[\\/:*?"<>|]/g, '') : ''}.${ext}`;
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function busy(btn, fn) {
    if (el('fit').classList.contains('over')) { alert('The CV is longer than one page, even with smaller text. Shorten it first: the message under the preview says by how much.'); return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing…';
    try { await fn(); } catch (err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = label; }
  }

  el('dl-word').addEventListener('click', e => busy(e.currentTarget, async () => {
    await script('vendor/docx.min.js');
    download(await window.docx.Packer.toBlob(buildDocx(window.docx, cv, scale)), fileName('docx'));
  }));
  el('dl-pdf').addEventListener('click', e => busy(e.currentTarget, async () => {
    await Promise.all([script('vendor/jspdf.umd.min.js'), script('vendor/cvsans.js')]);
    const make = s => {
      const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });
      [['regular', 'normal'], ['bold', 'bold'], ['italic', 'italic']].forEach(([k, st]) => { doc.addFileToVFS(`CVSans-${k}.ttf`, window.CVSANS[k]); doc.addFont(`CVSans-${k}.ttf`, 'CVSans', st); });
      doc.setProperties({ title: cv.name ? `CV – ${cv.name}` : 'CV', author: cv.name || '', creator: cv.name || '' });
      return doc;
    };
    // use the preview's text size, and go smaller only if the PDF layout needs it
    let s = scale, probe = make(s);
    while (!layoutPdf(probe, cv, s, false).fits && s > MIN_SCALE) { s = Math.round((s - 0.01) * 100) / 100; probe = make(s); }
    if (!layoutPdf(probe, cv, s, false).fits) throw new Error('The CV is longer than one page. Shorten it a little and try again.');
    const doc = make(s);
    layoutPdf(doc, cv, s, true);
    download(doc.output('blob'), fileName('pdf'));
  }));
  el('save-file').addEventListener('click', () => download(new Blob([JSON.stringify(cv, null, 2)], { type: 'application/json' }), fileName('json')));

  /* Upload */
  async function readPdf(file) {
    await script('vendor/pdf.min.js');
    const pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const pageW = page.view[2] - page.view[0];
      const tc = await page.getTextContent();
      const rows = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const y = it.transform[5], x = it.transform[4], h = Math.abs(it.transform[3]) || 10;
        let row = rows.find(r => Math.abs(r.y - y) < Math.max(r.h, h) * 0.45);
        if (!row) { row = { y, h, items: [] }; rows.push(row); }
        row.items.push({ x, str: it.str, w: it.width, h });
      });
      rows.sort((a, b) => b.y - a.y);
      rows.forEach(r => {
        r.items.sort((a, b) => a.x - b.x);
        // split a row into segments at wide gaps: columns and right-aligned dates
        let seg = null, end = null;
        const segs = [];
        r.items.forEach(it => {
          const gap = end === null ? 0 : it.x - end;
          if (!seg || gap > r.h * 0.8) { seg = { x: it.x, text: '' }; segs.push(seg); }
          else if (gap > r.h * 0.12 && !/\s$/.test(seg.text) && !/^\s/.test(it.str)) seg.text += ' ';
          seg.text += it.str; end = it.x + it.w;
        });
        segs.forEach(sg => out.push({ text: sg.text, x: sg.x, pageW }));
      });
    }
    // a bullet sign on its own belongs to the text after it
    const merged = [];
    out.forEach(l => {
      const prev = merged[merged.length - 1];
      if (prev && /^[•●▪◦‣∙\uf0b7\uf0a7]$/.test(prev.text.trim())) { prev.text = '• ' + l.text; prev.bullet = true; prev.x = l.x; }
      else merged.push(l);
    });
    return merged;
  }
  async function readDocx(file) {
    await script('vendor/fflate.min.js');
    const files = window.fflate.unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: f => f.name === 'word/document.xml' });
    const xml = new TextDecoder().decode(files['word/document.xml']);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const out = [];
    Array.from(doc.getElementsByTagNameNS(W, 'p')).forEach(p => {
      let t = '';
      const walk = n => {
        n.childNodes.forEach(c => {
          if (c.namespaceURI !== W) return;
          if (c.localName === 't') t += c.textContent;
          else if (c.localName === 'tab') t += '   ';
          else if (c.localName === 'br') t += '\n';
          else if (c.localName !== 'pPr' && c.localName !== 'rPr') walk(c);
        });
      };
      walk(p);
      const bullet = p.getElementsByTagNameNS(W, 'numPr').length > 0;
      t.split('\n').forEach((part, i) => out.push({ text: part, bullet: bullet && i === 0 }));
    });
    return out;
  }
  function report(result, fileLabel) {
    const box = el('import-report'); box.hidden = false; box.textContent = '';
    const c = result.cv;
    const n = k => c[k].filter(hasEntry).length;
    const p = document.createElement('p');
    p.textContent = `Read ${fileLabel}: ${n('education')} education entries, ${n('experience')} jobs, ${n('roles')} roles${c.summary ? ', a summary' : ''}${c.dataSkills || c.languages ? ', skills and languages' : ''}. Check every section below before you download, or improve the wording with AI in the next step.`;
    box.append(p);
    const missing = ['name', 'email', 'phone'].filter(k => !c[k]);
    if (missing.length) { const m = document.createElement('p'); m.textContent = `Not found: ${missing.join(', ')}.`; box.append(m); }
    if (result.unplaced.length) {
      const m = document.createElement('p'); m.textContent = 'Lines that did not fit a section, so they are not on the CV:'; box.append(m);
      const ul = document.createElement('ul');
      result.unplaced.slice(0, 12).forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
      box.append(ul);
    }
  }
  el('upload').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    const box = el('import-report'); box.hidden = false; box.textContent = 'Reading the file…';
    try {
      const name = f.name.toLowerCase();
      if (name.endsWith('.json') || f.type === 'application/json') {
        cv = { ...clone(EMPTY), ...JSON.parse(await f.text()) };
        box.textContent = 'Opened your saved CV.';
      } else {
        let raw;
        if (name.endsWith('.pdf') || f.type === 'application/pdf') raw = await readPdf(f);
        else if (name.endsWith('.docx')) raw = await readDocx(f);
        else if (name.endsWith('.txt') || f.type.startsWith('text/')) raw = (await f.text()).split(/\r?\n/).map(t => ({ text: t }));
        else throw new Error('Upload a PDF, a Word file (.docx), a text file or a file saved from this page.');
        if (!raw.some(l => l.text.trim())) throw new Error('No text was found in the file. If it is a scanned PDF, the text is an image and cannot be read.');
        const result = parseCv(raw);
        cv = result.cv;
        report(result, f.name);
      }
      renderEditor(); changed();
    } catch (err) { box.textContent = err.message && !/JSON/.test(err.message) ? err.message : 'That file could not be read.'; }
  });

  /* AI assistant round trip */
  el('copy-prompt').addEventListener('click', async () => {
    const text = aiPrompt(cv);
    try { await navigator.clipboard.writeText(text); el('copy-status').textContent = 'Copied. Paste it into your AI assistant.'; }
    catch (err) { const box = el('prompt-box'); box.hidden = false; box.value = text; box.focus(); box.select(); el('copy-status').textContent = 'Copy the text in the box below.'; }
  });
  el('ai-import').addEventListener('click', () => {
    try {
      const next = readJsonAnswer(el('ai-answer').value);
      cv = next; renderEditor(); changed();
      el('ai-status').textContent = 'Done. The CV is updated. Fill in any [add number] the checks under "Make it stronger" point to.';
      el('ai-answer').value = '';
    } catch (err) { el('ai-status').textContent = 'That did not look like the JSON the prompt asks for. Paste the whole answer.'; }
  });

  el('load-example').addEventListener('click', () => { cv = clone(EXAMPLE); el('import-report').hidden = true; renderEditor(); changed(); });
  el('clear').addEventListener('click', () => { if (confirm('Clear everything you have entered?')) { cv = clone(EMPTY); el('import-report').hidden = true; renderEditor(); changed(); } });
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { cv.lang = b.dataset.lang; renderEditor(); changed(); }));

  // Edit / Preview tabs on narrow screens
  document.querySelectorAll('.view-tabs [data-view]').forEach(b => b.addEventListener('click', () => {
    document.body.dataset.view = b.dataset.view;
    document.querySelectorAll('.view-tabs [data-view]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
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
