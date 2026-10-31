// Behavior in the browser: the menu, tooltips, charts, live lessons, the tutor
// and reading a CSV file. Pages work without it except where they are live.
import { readPermitCsv, writePermitCsv } from '/static/csv.js';

const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- menu ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-menu]');
  if (!b) return;
  const d = document.getElementById('drawer');
  const open = !d.classList.contains('open');
  d.classList.toggle('open', open);
  b.setAttribute('aria-expanded', String(open));
});

// ---------- small form helpers ----------
document.addEventListener('change', e => {
  const f = e.target.closest('form[data-autosubmit]');
  if (f) f.submit();
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-confirm]');
  if (f && !window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
});

// ---------- tooltip ----------
const tip = document.getElementById('tip');
function showTip(t, cx, cy) {
  tip.textContent = t; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = Math.min(window.innerWidth - w - 8, cx + 14), y = cy - h - 12;
  if (y < 8) y = cy + 16;
  tip.style.left = `${Math.max(8, x)}px`; tip.style.top = `${y}px`;
}
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) showTip(el.getAttribute('data-tip'), e.clientX, e.clientY); else tip.hidden = true;
});
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el && e.pointerType === 'touch') { showTip(el.getAttribute('data-tip'), e.clientX, e.clientY); clearTimeout(showTip.t); showTip.t = setTimeout(() => { tip.hidden = true; }, 2500); }
});
window.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

// ---------- charts ----------
const FMT = { pct: v => `${Math.round(v)}%`, r1: v => (+v).toFixed(1), n: v => String(v) };

function lineChart(el, o) {
  const W = Math.max(260, Math.floor(el.clientWidth)), narrow = W < 480, H = el.clientHeight || 230;
  const m = { l: 42, r: narrow ? 14 : 116, t: 14, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.labels.length;
  const x = i => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = v => m.t + ih - ((v - o.min) / (o.max - o.min)) * ih;
  const f = FMT[o.fmt] || FMT.n;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">`;
  o.ticks.forEach(t => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="#21262D" stroke-width="1"></line><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${f(t)}</text>`; });
  s += `<line x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}" stroke="#30363D" stroke-width="1"></line>`;
  const every = Math.ceil(n / Math.max(1, Math.floor(iw / 34)));
  o.labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle">${esc(lb)}</text>`; });
  const ends = [];
  o.series.forEach(se => {
    let d = '', pen = false, last = null;
    se.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; pen = true; last = i; });
    s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${se.dash ? ' stroke-dasharray="5 4"' : ''}></path>`;
    if (!se.dash) se.values.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${se.color}" stroke="#161B22" stroke-width="2"></circle>`; });
    if (last != null) ends.push({ y: y(se.values[last]), x: x(last), t: `${se.name} ${f(se.values[last])}` });
  });
  if (!narrow && ends.length) {
    ends.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) if (ends[k].y - (ends[k - 1].ly || ends[k - 1].y) < 16) ends[k].ly = (ends[k - 1].ly || ends[k - 1].y) + 16;
    ends.forEach(e => { const ly = e.ly || e.y; if (e.ly) s += `<line x1="${e.x + 5}" y1="${e.y}" x2="${e.x + 12}" y2="${ly}" stroke="#8B949E" stroke-width="1"></line>`; s += `<text class="lbl" x="${e.x + 14}" y="${ly + 4}">${esc(e.t)}</text>`; });
  }
  const cw = n > 1 ? iw / (n - 1) : iw;
  o.labels.forEach((lb, i) => {
    const head = o.tips && o.tips[i] ? o.tips[i] : lb;
    const t = `${head}\n${o.series.map(se => `${se.name}: ${se.values[i] == null ? 'no data' : f(se.values[i])}`).join('\n')}`;
    s += `<rect x="${x(i) - cw / 2}" y="${m.t}" width="${cw}" height="${ih}" fill="transparent" data-tip="${esc(t)}"></rect>`;
  });
  el.innerHTML = `${s}</svg>`;
}

// Importance against score. The dividing lines sit at the averages, so the
// shaded corner holds the dimensions that score below average and matter more.
function scatter(el, o) {
  const W = Math.max(260, Math.floor(el.clientWidth)), narrow = W < 480, H = narrow ? 300 : el.clientHeight || 320;
  const m = { l: 48, r: 18, t: 18, b: 44 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const xs = o.points.map(p => p.x), ys = o.points.map(p => p.y);
  const x0 = Math.floor((Math.min(...xs) - 0.2) * 2) / 2, x1 = Math.ceil((Math.max(...xs) + 0.2) * 2) / 2;
  const y0 = Math.floor((Math.min(...ys) - 0.08) * 10) / 10, y1 = Math.ceil((Math.max(...ys) + 0.08) * 10) / 10;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const x = v => m.l + ((v - x0) / (x1 - x0)) * iw, y = v => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">`;
  s += `<rect x="${m.l}" y="${m.t}" width="${x(mx) - m.l}" height="${y(my) - m.t}" fill="rgba(242,204,96,0.07)"></rect>`;
  for (let t = x0; t <= x1 + 1e-9; t += 0.5) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${m.t + ih}" stroke="#21262D"></line><text x="${x(t)}" y="${m.t + ih + 16}" text-anchor="middle">${t.toFixed(1)}</text>`;
  const ystep = y1 - y0 > 0.6 ? 0.2 : 0.1;
  for (let t = y0; t <= y1 + 1e-9; t += ystep) s += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(t)}" y2="${y(t)}" stroke="#21262D"></line><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(1)}</text>`;
  s += `<line x1="${x(mx)}" x2="${x(mx)}" y1="${m.t}" y2="${m.t + ih}" stroke="#484F58"></line><line x1="${m.l}" x2="${m.l + iw}" y1="${y(my)}" y2="${y(my)}" stroke="#484F58"></line>`;
  s += `<text class="q" x="${m.l + 8}" y="${m.t + 16}">Fix first</text><text class="q" x="${m.l + iw - 8}" y="${m.t + 16}" text-anchor="end">Keep strong</text><text class="q" x="${m.l + 8}" y="${m.t + ih - 8}">Watch</text><text class="q" x="${m.l + iw - 8}" y="${m.t + ih - 8}" text-anchor="end">Lower priority</text>`;
  s += `<text x="${m.l + iw / 2}" y="${H - 4}" text-anchor="middle">average score, 1 to 5</text><text x="12" y="${m.t + ih / 2}" text-anchor="middle" transform="rotate(-90 12 ${m.t + ih / 2})">importance</text>`;
  // Labels that would overlap a label placed just before are moved down a line.
  const placed = [];
  [...o.points].sort((a, b) => b.y - a.y).forEach(d => {
    const cx = x(d.x), right = cx < m.l + iw * 0.7;
    let ly = y(d.y) + 4;
    for (const q of placed) if (q.right === right && Math.abs(q.cx - cx) < 130 && Math.abs(q.ly - ly) < 15) ly = q.ly + 15;
    placed.push({ cx, ly, right });
    d._ly = ly;
  });
  o.points.forEach(d => {
    const fix = d.x < mx && d.y > my, cx = x(d.x), cy = y(d.y);
    const right = cx < m.l + iw * 0.7;
    s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${fix ? '#F2CC60' : '#3DDC97'}" stroke="#161B22" stroke-width="2"></circle>`;
    const lab = narrow && d.label.length > 12 ? d.label.split(' ')[0] : d.label;
    s += `<text class="lbl" x="${cx + (right ? 10 : -10)}" y="${d._ly}" text-anchor="${right ? 'start' : 'end'}">${esc(lab)}</text>`;
    s += `<circle cx="${cx}" cy="${cy}" r="14" fill="transparent" data-tip="${esc(`${d.label}\naverage score ${d.x.toFixed(1)} of 5\nimportance ${d.y.toFixed(2)}${fix ? '\nquadrant: fix first' : ''}`)}"></circle>`;
  });
  el.innerHTML = `${s}</svg>`;
}

function drawCharts() {
  $$('[data-chart]').forEach(el => {
    try {
      const o = JSON.parse(el.getAttribute('data-chart'));
      if (o.type === 'scatter') scatter(el, o); else lineChart(el, o);
    } catch (e) { console.error(e); }
  });
}
drawCharts();
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawCharts, 80); });

// ---------- live lessons ----------
// Each live block polls its address and replaces itself when the content changes.
function timers() {
  $$('[data-closes]').forEach(el => {
    const end = Date.parse(el.getAttribute('data-closes'));
    if (!end) return;
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  });
}
setInterval(timers, 250);
timers();

async function refresh(box) {
  try {
    const r = await fetch(box.getAttribute('data-live'), { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.status === 401) { location.href = '/signin'; return; }
    if (!r.ok) return;
    const d = await r.json();
    if (d.key !== box.getAttribute('data-key')) {
      box.innerHTML = d.html;
      box.setAttribute('data-key', d.key);
      timers();
    }
  } catch { /* the next poll tries again */ }
}
const boxes = $$('[data-live]');
if (boxes.length) {
  setInterval(() => { if (!document.hidden) boxes.forEach(refresh); }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) boxes.forEach(refresh); });
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-answer]');
  if (!b) return;
  const box = b.closest('[data-live]');
  $$('[data-answer]', box || document).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  try {
    const r = await fetch('/api/live/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: b.getAttribute('data-item'), choice: b.getAttribute('data-answer') }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alertLive(box, d.error || 'The answer was not recorded.'); }
  } catch { alertLive(box, 'The answer was not recorded. Check your connection.'); }
  if (box) refresh(box);
});
function alertLive(box, text) {
  if (!box) return;
  const p = document.createElement('p');
  p.className = 'alert'; p.textContent = text;
  box.prepend(p);
}

// ---------- the tutor ----------
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-tutor]');
  if (!f) return;
  e.preventDefault();
  const input = f.querySelector('input[name="question"]');
  const q = input.value.trim();
  if (!q) return;
  const card = f.closest('.card');
  const log = card.querySelector('[data-tutor-log]');
  const left = card.querySelector('[data-tutor-left]');
  log.insertAdjacentHTML('beforeend', `<div class="bubble-me">${esc(q)}</div>`);
  input.value = ''; input.disabled = true;
  const wait = document.createElement('div');
  wait.className = 'bubble-ag'; wait.innerHTML = '<p class="agent" style="margin:0 0 6px">@tutor</p><div class="b muted">Looking in the rules…</div>';
  log.append(wait);
  try {
    const r = await fetch('/api/tutor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) });
    const d = await r.json();
    const body = d.error ? esc(d.error) : d.passed ? esc(d.text) : `${esc(d.answer).replace(/\n/g, '<br>')}${d.source ? ` <span class="chip" style="margin-top:8px">source: ${esc(d.source)}</span>` : ''}`;
    wait.querySelector('.b').classList.remove('muted');
    wait.querySelector('.b').innerHTML = body;
    if (left && d.left != null) left.textContent = `questions left today: ${d.left} of 20`;
  } catch {
    wait.querySelector('.b').textContent = 'The tutor could not be reached. Try again in a minute.';
  }
  input.disabled = false; input.focus();
});

// ---------- reading a CSV of permitted addresses ----------
// The file is read here, in the browser. Only the names, email, group and
// institution of each row are put into the form, so other columns, such as ID
// numbers, are never sent.
document.addEventListener('change', async e => {
  const input = e.target.closest('input[data-csv-file]');
  if (!input || !input.files[0]) return;
  const f = input.closest('form');
  const text = await input.files[0].text();
  const rows = readPermitCsv(text);
  f.querySelector('[data-csv-text]').value = writePermitCsv(rows);
  const groups = [...new Set(rows.map(r => r.group).filter(Boolean))];
  const named = rows.filter(r => r.first || r.last).length;
  f.querySelector('[data-csv-status]').textContent = rows.length
    ? `${rows.length} addresses read from ${input.files[0].name}${groups.length ? ` in ${groups.length} group${groups.length > 1 ? 's' : ''}` : ''}, ${named} with names. Only the names, email, group and institution columns were read. Press "Add to the list" to save them.`
    : `No email addresses were found in ${input.files[0].name}.`;
});

// ---------- the helper ----------
// The conversation lives in this browser tab only (sessionStorage), and each
// question sends the recent turns so that the helper can follow the thread.
(() => {
  const fab = document.querySelector('[data-helper-open]');
  const panel = document.getElementById('helper');
  if (!fab || !panel) return;
  const log = panel.querySelector('[data-helper-log]');
  const form = panel.querySelector('[data-helper-form]');
  const box = form.querySelector('textarea');
  const note = panel.querySelector('[data-helper-note]');
  const KEY = 'saw-helper';
  let turns = [];
  try { turns = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { turns = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-24))); } catch { /* private window */ } };
  // Answers use a little Markdown. The text is escaped first, and only bold,
  // italics, code and headings are then turned into markup, so no HTML from
  // an answer can reach the page.
  const esc = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = t => esc(t)
    .replace(/^#{1,4} +(.+)\n?/gm, '<strong class="hh">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/^[-*] +/gm, '• ');
  const add = (cls, text) => { const d = document.createElement('div'); d.className = `hm ${cls}`; if (cls === 'a') d.innerHTML = md(text); else d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  for (const t of turns) add(t.role === 'user' ? 'u' : 'a', t.text);
  const open = () => { panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); box.focus(); log.scrollTop = log.scrollHeight; };
  const close = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.focus(); };
  fab.addEventListener('click', open);
  panel.querySelector('[data-helper-close]').addEventListener('click', close);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const q = box.value.trim();
    if (!q) return;
    box.value = ''; box.disabled = true;
    add('u', q);
    turns.push({ role: 'user', text: q }); save();
    const wait = add('w', 'Thinking…');
    try {
      const r = await fetch('/api/helper', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ turns }) });
      const data = await r.json().catch(() => ({}));
      wait.remove();
      if (r.ok && data.text) { add('a', data.text); turns.push({ role: 'assistant', text: data.text }); save(); }
      else { add('e', data.error || 'The Teaching Assistant could not answer just now.'); turns.pop(); save(); }
      if (typeof data.left === 'number') note.textContent = `Your name and address are not sent with your questions. ${data.left} question${data.left === 1 ? '' : 's'} left today.`;
    } catch {
      wait.remove(); add('e', 'The Teaching Assistant could not be reached. Check your connection.'); turns.pop(); save();
    }
    box.disabled = false; box.focus();
  });
})();
