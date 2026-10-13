/* Learning to use AI proficiently: figure 2 dots, copy buttons and the prompt builder */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  /* ---------- Figure 2: answer space shrinking ---------- */
  // fixed pseudo-random positions so the figure looks the same on every load
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = Array.from({ length: 60 }, () => [10 + rand() * 100, 10 + rand() * 70]);
  const target = [60, 45];
  // sort by distance to the target so smaller sets stay clustered around it
  const byDist = pts.slice().sort((a, b) => Math.hypot(a[0] - target[0], a[1] - target[1]) - Math.hypot(b[0] - target[0], b[1] - target[1]));
  document.querySelectorAll('svg[data-dots]').forEach(svg => {
    const n = +svg.dataset.dots, NS = 'http://www.w3.org/2000/svg';
    const keep = n >= pts.length ? pts : byDist.slice(0, n);
    keep.forEach(p => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); c.setAttribute('r', 3.2); c.setAttribute('class', 'g-dot'); svg.append(c); });
    const t = document.createElementNS(NS, 'circle');
    t.setAttribute('cx', target[0]); t.setAttribute('cy', target[1]); t.setAttribute('r', 6); t.setAttribute('class', 'g-dot hit');
    svg.append(t);
  });

  /* ---------- copy ---------- */
  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = ok ? 'Copied' : 'Select and copy';
    setTimeout(() => { btn.textContent = old; }, 1600);
    return ok;
  }
  document.querySelectorAll('.g-prompt').forEach(box => {
    const head = document.createElement('div'); head.className = 'g-prompt-head';
    const title = document.createElement('span'); title.textContent = box.dataset.title || 'Prompt';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy prompt: ' + title.textContent);
    btn.addEventListener('click', () => copy(box.querySelector('pre').textContent, btn));
    head.append(title, btn); box.prepend(head);
  });

  /* ---------- prompt builder ---------- */
  const PRESETS = {
    market: { task: 'A market analysis of a given market and country', goal: 'A business student preparing analyses for investment and strategy discussions, who wants clear conclusions backed by sources', ins: 'Structure: scope and key question; market size, growth and shares with sources; competitor profiles with the same headings for each; PESTEL limited to factors that matter in the next three years; SWOT for one company where every point refers back to a fact; five key points and three things to watch.' },
    coach: { task: 'A 30-day personal brand coach', goal: 'Someone starting to post online who wants a plan, daily tasks and feedback on drafts', ins: '' },
    exam: { task: 'An exam revision coach for a university course', goal: 'A student who wants to find and fix weak spots before the exam, not just reread notes', ins: 'Method: map the syllabus, test me with questions before explaining, focus time on what I get wrong, use spaced repetition, and finish with a timed practice exam.' },
    blank: { task: '', goal: '', ins: '' }
  };
  const f = { task: $('b-task'), goal: $('b-goal'), ins: $('b-ins') };
  const ph = { p1: $('b-p1'), p2: $('b-p2'), p3: $('b-p3'), src: $('b-src'), blunt: $('b-blunt') };

  function build() {
    const task = f.task.value.trim() || '[what the prompt is for]';
    const goal = f.goal.value.trim() || '[who will use it, and what they want to achieve]';
    const ins = f.ins.value.trim();
    const phases = [];
    if (ph.p1.checked) phases.push('Gather context. Ask the user one question at a time about everything you need to know to do the task well. Wait for each answer before asking the next. When you have enough, summarise what you know and ask the user to confirm.');
    if (ph.p2.checked) phases.push('Plan. Propose a step-by-step plan and let the user adjust it before you start.');
    if (ph.p3.checked) phases.push('Execute and coach. Produce a first draft. Then point out its weakest parts and suggest specific improvements, and revise when asked.');
    const rules = ['Follow the instructions below closely. Do not fall back on generic advice.', 'If something is unclear, ask instead of guessing.'];
    if (ph.src.checked) rules.push('Give a source for every fact and number, and say clearly when something is uncertain or estimated.');
    if (ph.blunt.checked) rules.push('Be direct and critical. Do not soften feedback or praise weak work.');
    let out = `You are an expert prompt engineer. Your job is to write a prompt that I will paste into a new chat. Do not do the task itself.

The prompt is for: ${task}
The person using it: ${goal}
`;
    if (phases.length) out += `\nThe prompt must make the AI work in ${phases.length === 1 ? 'this phase' : 'these phases, in order'}:\n` + phases.map((p, i) => `Phase ${i + 1}. ${p}`).join('\n') + '\n';
    out += '\nThe prompt must include these rules:\n' + rules.map(r => '- ' + r).join('\n') + '\n';
    out += ins
      ? `\nBuild the prompt on these instructions for how the task should be done:\n"""\n${ins}\n"""\n`
      : '\nI have no written instructions for the task. Include detailed, expert-level instructions for how it should be done, based on recognised best practice, and say where they come from.\n';
    out += '\nWrite the finished prompt in one code block, with clear headings. Before you write it, ask me up to three questions if anything about the task is unclear.';
    $('b-out').value = out;
  }
  function preset(name) {
    const p = PRESETS[name];
    f.task.value = p.task; f.goal.value = p.goal; f.ins.value = p.ins;
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
    build();
  }
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => preset(b.dataset.preset)));
  [f.task, f.goal, f.ins].forEach(el => el.addEventListener('input', () => {
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    build();
  }));
  Object.values(ph).forEach(el => el.addEventListener('change', build));
  $('b-copy').addEventListener('click', async () => {
    const ok = await copy($('b-out').value, $('b-copy'));
    $('b-msg').textContent = ok ? 'Copied. Paste it into a new chat.' : 'Copying was blocked. Select the text and copy it manually.';
    if (!ok) $('b-out').select();
  });
  preset('market');
})();
