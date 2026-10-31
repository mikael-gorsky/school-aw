// The teacher's pages. Every route under /teacher is open only to the teacher
// role; the demo login never reaches them (decision of 31 October 2026).
// Rating figures come from model.satisfaction(), which hides any figure that
// rests on fewer than 5 answers (decision of 29 October 2026).
import { esc, pad, I, stat, ag, agS, head, logLines, tiles, hbars, cols, chart, fmtDate, fmtDay } from '../html.js';
import { programme, moduleContent, moduleTitle, hasExam, lessonTitle, lessonModulesLabel, lessonModules } from '../content.js';
import { all, get, setting } from '../db.js';
import { aiAvailable } from '../ai.js';
import { activeAgents } from './public.js';
import * as M from '../model.js';

const r1 = v => (v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1));
const gq = ctx => `?group=${ctx.group.id}`;
const hidden = ctx => `<input type="hidden" name="group" value="${ctx.group.id}">`;
// A student appears by name with the address under it, and the name opens the
// student's details and comment (decision of 31 October 2026).
function who(u, id = u.id) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
  if (!id) return name ? `<span style="font-weight:600">${esc(name)}</span><span class="mono small" style="display:block">${esc(u.email)}</span>` : `<span class="m">${esc(u.email)}</span>`;
  return name
    ? `<a href="/teacher/student/${id}" style="color:var(--fg);font-weight:600">${esc(name)}</a><span class="mono small" style="display:block">${esc(u.email)}</span>`
    : `<a class="mono" href="/teacher/student/${id}" style="color:var(--fg)">${esc(u.email)}</a>`;
}

function trendIc(t) {
  return `<span style="color:${t === 'up' ? 'var(--accent)' : t === 'down' ? 'var(--warn)' : 'var(--muted)'}" aria-label="trend ${t}">${I[t]}</span>`;
}
function projStat(state, pr) {
  if (state === 'passed') return stat('ok', 'passed');
  if (state === 'warning') return stat('warn', `${pr.last.warnings} warning${pr.last.warnings > 1 ? 's' : ''}`);
  if (state === 'failed') return stat('bad', `${pr.last.failed} failed`);
  if (state === 'submitted') return stat('none', 'not checked');
  return stat('none', 'not submitted');
}

// The group the teacher is looking at, with a switcher between groups.
function groupSwitch(ctx) {
  const groups = M.groupsAll();
  if (groups.length < 2) return '';
  return `<form method="get" class="row" style="gap:8px;flex-wrap:nowrap" data-autosubmit><label class="sr" for="gsel">group</label><select class="inp" id="gsel" name="group" style="min-height:40px;width:auto;font-family:var(--mono);font-size:13.5px">${groups.map(g => `<option value="${g.id}"${g.id === ctx.group.id ? ' selected' : ''}>${esc(M.groupLabel(g))}${g.is_demo ? ' (demo)' : ''}</option>`).join('')}</select><noscript><button class="btn out" type="submit">show</button></noscript></form>`;
}
function scope(ctx) {
  const g = ctx.group, p = programme(g.programme);
  return `${esc(p.title)} · ${esc(M.groupLabel(g))}`;
}
function noGroup() {
  return `<div class="wrap page">${head('setup', 'No group yet', 'Create a group by permitting the first addresses. Each address carries an institution, a group and a program.')}<a class="btn pri" href="/teacher/access">Open groups and access</a></div>`;
}

// Times typed into the teacher's forms are Israel time.
function tzOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return (Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second) - date.getTime()) / 60000;
}
export function fromLocalInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return new Date(guess - tzOffsetMinutes(new Date(guess)) * 60000).toISOString();
}

// ---------- Learn in class: the lesson console ----------
function activeCount(groupId) {
  const since = new Date(Date.now() - 10 * 60000).toISOString();
  return get("SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND role IN ('student','demo','sample') AND last_seen >= ?", groupId, since).n;
}

export function consolePartial(ctx) {
  const g = ctx.group;
  const lesson = M.liveLesson(g.id);
  if (!lesson) return { key: 'none', html: '' };
  M.tick(lesson);
  const items = M.itemsOf(lesson.id);
  const item = items.find(i => i.state === 'open') || [...items].filter(i => i.opened_at).sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
  const size = M.members(g.id).length;
  if (!item) {
    return { key: `wait-${lesson.id}`, html: `<div class="card hl"><p class="ch">lesson ${lesson.number} is running</p><p class="fg2" style="margin:0 0 14px">No exercise is open. Release the warm-up quiz or the first exercise from the lesson plan.</p></div>` };
  }
  const counts = M.answerCounts(item.id);
  const answered = Object.values(counts).reduce((s, x) => s + x, 0);
  const opts = JSON.parse(item.options);
  const max = Math.max(1, ...opts.map(([k]) => counts[k] || 0));
  const dist = opts.map(([k, t]) => ({ l: `[${k.toUpperCase()}] ${t}`, v: counts[k] || 0, tip: `${k.toUpperCase()} · ${t}\n${counts[k] || 0} answers${item.correct === k ? ' · correct' : ''}` }));
  const right = item.correct ? counts[item.correct] || 0 : null;
  const timer = item.state === 'open' ? `<p class="mono timer" data-closes="${esc(item.closes_at || '')}" style="margin:0;font-size:38px;font-weight:700;color:var(--accent);line-height:1">--:--</p>` : `<p class="mono" style="margin:0;font-size:20px;font-weight:700;color:var(--muted);line-height:1">${item.state === 'shown' ? 'results shown' : 'closed'}</p>`;
  const act = (a, label, cls = 'sec') => `<button type="submit" name="action" value="${a}" class="btn ${cls}">${label}</button>`;
  const nextReady = items.find(i => i.state === 'ready');
  const html = `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start;margin-bottom:14px"><div style="flex:1 1 300px"><p class="mono small" style="margin:0 0 6px">${esc(item.label.toLowerCase())} · ${item.correct ? 'choose one' : 'no right answer'}</p><h2 class="h2" style="font-size:23px;margin:0">${esc(item.question)}</h2></div><div style="text-align:right">${timer}<p class="mono small" style="margin:6px 0 0">${answered} of ${size} answered</p></div></div>
    <div style="border-top:1px solid var(--line);padding-top:16px">${hbars(dist, { max, fmt: v => v })}</div>
    ${item.correct && answered ? `<p class="status small" style="margin-top:10px"><span style="color:var(--accent)">${I.check}</span>${item.correct.toUpperCase()} is the correct answer. ${M.pct(right, answered)}% of those who answered chose it.</p>` : ''}
    <form method="post" action="/teacher/class/act" class="row" style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">${hidden(ctx)}<input type="hidden" name="item" value="${item.id}">
    ${item.state !== 'shown' ? act('show', 'Show results to the class', 'pri') : ''}${item.state === 'open' ? act('close', 'Close now') + act('minute', 'Add 1 minute') : ''}${nextReady ? `<button type="submit" name="action" value="release-next" class="btn out">release next</button>` : ''}</form></div>`;
  return { key: `${item.id}-${item.state}-${answered}`, html };
}

export function tClass(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const lesson = M.liveLesson(g.id);
  const size = M.members(g.id).length;
  if (!lesson) {
    const lessons = M.lessonsOf(g.id);
    const nextNo = lessons.length ? Math.max(...lessons.map(l => l.number)) + 1 : 1;
    const prog = programme(g.programme);
    // Suggest the first module that no lesson covers yet.
    const covered = new Set(lessons.flatMap(l => lessonModules(l)));
    const nextMod = (prog.modules.find(m => !covered.has(m.n)) || prog.modules[0]).n;
    const rows = lessons.map(l => `<tr><td class="m">${l.number}</td><td><span class="mono small" style="display:block">${esc(lessonModulesLabel(l))}</span>${esc(lessonTitle(g.programme, l))}</td><td class="m">${esc(fmtDate(l.starts_at))}</td><td>${l.state === 'ended' ? stat('ok', 'held') : '<span class="chip">planned</span>'}</td><td>${l.state === 'planned' ? `<form method="post" action="/teacher/class/act" class="inline">${hidden(ctx)}<input type="hidden" name="lesson" value="${l.id}"><button class="btn pri" style="min-height:38px" name="action" value="start">Start lesson</button></form>` : ''}</td></tr>`).join('');
    return `<div class="wrap page">${head('proctor --live', 'Learn in class', `No lesson is running · ${scope(ctx)}`, groupSwitch(ctx) + ag('proctor'))}
     <div class="cols" style="align-items:flex-start"><div class="card" style="--b:520px;flex:999 1 520px;padding:6px 0"><p class="ch" style="padding:16px 20px 0">lessons of this group</p>${lessons.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>lesson</th><th>modules</th><th>starts</th><th>state</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="fg2" style="padding:0 20px 16px;margin:0">No lessons yet. Add the first lesson.</p>'}</div>
     <form method="post" action="/teacher/class/act" class="card" style="flex:1 1 320px">${hidden(ctx)}<input type="hidden" name="action" value="add-lesson"><p class="ch">add a lesson</p>
      <div class="cols" style="--b:120px;gap:12px"><div style="flex:0 1 110px"><label class="f" for="ln">lesson</label><input class="inp" id="ln" name="number" type="number" min="1" max="99" value="${nextNo}" required></div><div><label class="f" for="lm">module</label><select class="inp" id="lm" name="module">${prog.modules.map(m => `<option value="${m.n}"${m.n === nextMod ? ' selected' : ''}>${pad(m.n)} ${esc(m.title)}</option>`).join('')}</select></div></div>
      <label class="f" for="lm2" style="margin-top:12px">second module in the same lesson (optional)</label><select class="inp" id="lm2" name="module2"><option value="">none</option>${prog.modules.map(m => `<option value="${m.n}">${pad(m.n)} ${esc(m.title)}</option>`).join('')}</select>
      <label class="f" for="ls" style="margin-top:12px">starts (Israel time)</label><input class="inp" id="ls" name="starts" type="datetime-local">
      <label class="f" for="lz" style="margin-top:12px">Zoom link</label><input class="inp" id="lz" name="zoom" type="url" placeholder="https://zoom.us/j/...">
      <button class="btn pri" type="submit" style="margin-top:14px">Add the lesson</button><p class="note">@proctor copies the warm-up quiz and the exercises of the module into the lesson plan. You can add items during the lesson.</p></form></div></div>`;
  }
  M.tick(lesson);
  const items = M.itemsOf(lesson.id);
  const counts = new Map(all('SELECT item_id, COUNT(*) AS n FROM answers WHERE item_id IN (SELECT id FROM items WHERE lesson_id = ?) GROUP BY item_id', lesson.id).map(r => [r.item_id, r.n]));
  const plan = items.map(it => {
    const on = it.state === 'open';
    const right = it.state === 'ready'
      ? `<form method="post" action="/teacher/class/act" class="inline">${hidden(ctx)}<input type="hidden" name="item" value="${it.id}"><button class="linkbtn mono" style="font-size:12.5px;color:var(--accent)" name="action" value="release">release</button></form>`
      : `<span class="mono" style="font-size:12.5px;color:${on ? 'var(--accent)' : 'var(--muted)'}">${it.state} · ${counts.get(it.id) || 0}</span>`;
    return `<div class="row" style="justify-content:space-between;flex-wrap:nowrap;padding:10px 8px;border-radius:8px;${on ? 'background:var(--accent-wash);border:1px solid var(--accent-line)' : ''}"><span style="font-weight:${on ? 800 : 600};font-size:14.5px">${esc(it.label)}</span>${right}</div>`;
  }).join('');
  const partial = consolePartial(ctx);
  const rated = M.ratingsByLesson(g.id).filter(r => r.n >= M.MIN_GROUP).pop();
  const active = activeCount(g.id);
  return `<div class="wrap page">${head('proctor --live', 'Learn in class', `Lesson ${lesson.number} · ${esc(lessonTitle(g.programme, lesson))} · ${scope(ctx)}`, `<span class="chip solid">live</span><span class="chip">${active} of ${size} active in the last 10 minutes</span>${groupSwitch(ctx)}${ag('proctor')}`)}
   <div class="cols" style="align-items:flex-start">
   <div class="card" style="--b:240px;flex:1 1 240px;padding:16px 12px"><p class="ch" style="padding:0 8px">lesson plan</p>${plan}
    <details style="margin-top:10px"><summary class="btn sec wide" style="border-style:dashed;font-family:var(--mono);font-weight:500;font-size:13px;list-style:none">+ add an item</summary>
    <form method="post" action="/teacher/class/act" style="padding:12px 8px 4px">${hidden(ctx)}<input type="hidden" name="lesson" value="${lesson.id}"><input type="hidden" name="action" value="add-item">
     <label class="f" for="iq">question</label><textarea class="inp" id="iq" name="question" rows="2" required maxlength="400"></textarea>
     ${['a', 'b', 'c', 'd'].map(k => `<label class="f" for="io${k}" style="margin-top:8px">option ${k.toUpperCase()}</label><input class="inp" id="io${k}" name="opt_${k}" maxlength="200"${k < 'c' ? ' required' : ''}>`).join('')}
     <label class="f" for="ic" style="margin-top:8px">correct answer</label><select class="inp" id="ic" name="correct"><option value="">none (an opinion question)</option><option>a</option><option>b</option><option>c</option><option>d</option></select>
     <button class="btn pri" type="submit" style="margin-top:12px">Add the item</button></form></details></div>
   <div style="--b:480px;flex:999 1 480px"><div data-live="/teacher/class/live${gq(ctx)}" data-key="${esc(partial.key)}">${partial.html}</div></div>
   <div class="stack" style="flex:1 1 260px">
    <div class="card"><p class="ch">what the class sees</p><p class="fg2" style="margin:0;font-size:14.5px">The question, the options and the timer. The results appear when you show them.</p></div>
    <div class="card"><p class="ch">after the lesson</p><p class="fg2" style="margin:0 0 10px;font-size:14.5px">${agS('analyst')} opens the lesson rating when you end the lesson.${rated ? ` Lesson ${rated.number} got ${r1(rated.avg)} of 5 from ${rated.n} students.` : ''}</p>
     <form method="post" action="/teacher/class/act">${hidden(ctx)}<input type="hidden" name="lesson" value="${lesson.id}"><button class="btn sec wide" name="action" value="end">End the lesson</button></form>
     <a class="mono" href="/teacher/satisfaction${gq(ctx)}" style="font-size:13px;min-height:40px;display:inline-flex;align-items:center">open the satisfaction report</a></div>
   </div></div></div>`;
}

// ---------- Study alone ----------
export function tStudy(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const prog = programme(g.programme);
  const people = M.members(g.id);
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const ids = people.map(p => p.id);
  const inList = ids.length ? ids.join(',') : '0';
  const sessions = get(`SELECT COUNT(*) AS n FROM (SELECT DISTINCT user_id, module, substr(at, 1, 10) FROM practice WHERE user_id IN (${inList}) AND at >= ?)`, week).n;
  const asked = get(`SELECT COALESCE(SUM(count), 0) AS n FROM tutor_usage WHERE user_id IN (${inList}) AND day >= ?`, week.slice(0, 10)).n;
  const passed = all('SELECT * FROM tutor_passed WHERE programme = ? AND handled = 0 ORDER BY at DESC', g.programme);
  const answered = all('SELECT * FROM tutor_passed WHERE programme = ? AND handled = 1 AND answer IS NOT NULL ORDER BY at DESC LIMIT 5', g.programme);
  const pracs = people.map(p => M.practiceOf(p.id, g.programme));
  const mods = Object.keys(pracs[0] || M.practiceOf(0, g.programme)).map(Number);
  const acc = mods.map(n => {
    const vals = pracs.map(p => p[n] && p[n].accuracy).filter(v => v != null);
    return { n, v: vals.length ? Math.round(M.avg(vals)) : null, k: vals.length };
  });
  const weakest = acc.filter(a => a.v != null).sort((a, b) => a.v - b.v)[0];
  const pm = acc.map(a => ({ l: `${pad(a.n)} ${moduleTitle(g.programme, a.n)}`, v: a.v, w: a.v != null && a.v < 65, tip: `Module ${a.n}: ${moduleTitle(g.programme, a.n)}\n${a.v == null ? 'no practice yet' : `class practice accuracy ${a.v}%`}\n${a.k} students practiced` }));
  const q = passed.map(x => `<form method="post" action="/teacher/study/answer" style="padding:12px 0;border-bottom:1px solid var(--line2)">${hidden(ctx)}<input type="hidden" name="id" value="${x.id}"><p style="margin:0 0 4px;font-weight:700">${esc(x.question)}</p><p class="small" style="margin:0 0 10px">asked ${esc(fmtDate(x.at))}</p>
    <label class="sr" for="qa${x.id}">your answer</label><textarea class="inp" id="qa${x.id}" name="answer" rows="2" maxlength="2000" placeholder="Your answer"></textarea>
    <label class="tog" style="margin-top:8px"><input type="checkbox" name="rule" value="1" checked><span>@tutor uses this answer from now on</span></label>
    <div class="row" style="margin-top:10px"><button type="submit" name="do" value="answer" class="btn sec" style="min-height:40px;font-size:14px">Answer</button><button type="submit" name="do" value="ignore" class="btn out" style="min-height:40px" formnovalidate>ignore</button></div></form>`).join('');
  return `<div class="wrap page">${head('tutor --report', 'Study alone', `How the class studies between lessons, and what ${agS('tutor')} could not answer · ${scope(ctx)}`, groupSwitch(ctx))}
   ${tiles([['practice sessions this week', String(sessions)], ['questions to @tutor', String(asked), 'this week'], ['passed to you', String(passed.length), 'questions outside the rules', passed.length ? 'down' : ''], ['weakest module', weakest ? pad(weakest.n) : '–', weakest ? `practice accuracy ${weakest.v}%` : 'no practice yet', weakest ? 'down' : '']])}
   <div class="cols section" style="align-items:flex-start"><div class="card" style="--b:460px;flex:999 1 460px"><p class="ch">practice accuracy by module <span class="r">class average</span></p>${pm.length ? hbars(pm, { max: 100, fmt: v => `${v}%` }) : '<p class="fg2" style="margin:0">No module has a study page yet.</p>'}<p class="note">Bars in yellow are below 65%. Only modules with a study page are shown.</p></div>
   <div class="card" style="flex:1 1 340px"><p class="ch">questions @tutor passed to you</p>${q || '<p class="fg2" style="margin:0">No questions wait for you. When @tutor cannot answer from the rules, the question appears here without the name of the student who asked.</p>'}
   ${answered.length ? `<p class="ch" style="margin-top:18px">answered recently</p>${answered.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--line2)"><p style="margin:0;font-weight:700;font-size:14.5px">${esc(a.question)}</p><p class="fg2" style="margin:2px 0 0;font-size:14.5px">${esc(a.answer)}</p></div>`).join('')}` : ''}</div></div>
   <div class="section card flat"><p class="ch">what @tutor answers from</p><p class="fg2" style="margin:0">@tutor answers from the program description, the rules in content/${esc(g.programme)}/rules.md and the answers you add here. Questions reach the AI service without the student's name or email address.${aiAvailable() ? '' : ' The tutor is not connected yet, because ANTHROPIC_API_KEY is not set in the pod.'}</p></div></div>`;
}

// ---------- Submit projects ----------
export function tProjects(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const people = M.members(g.id);
  const data = people.map(p => ({ p, pr: M.projectsOf(p.id) }));
  const st = (d, k) => M.projectState(d.pr[k]);
  const n = people.length;
  const ownSub = data.filter(d => st(d, 'own') !== 'none').length, ownPass = data.filter(d => st(d, 'own') === 'passed').length;
  const trSub = data.filter(d => st(d, 'tribunal') !== 'none').length, trPass = data.filter(d => st(d, 'tribunal') === 'passed').length;
  const fails = {};
  for (const d of data) for (const k of ['own', 'tribunal']) {
    const last = d.pr[k].last;
    if (!last) continue;
    for (const r of JSON.parse(last.results)) if (r.state === 'bad' || r.state === 'warn') fails[r.title] = (fails[r.title] || 0) + 1;
  }
  const fl = Object.entries(fails).sort((a, b) => b[1] - a[1]);
  const top = fl[0];
  const rows = data.map(d => {
    const last = [d.pr.own.last, d.pr.tribunal.last].filter(Boolean).sort((a, b) => b.at.localeCompare(a.at))[0];
    const links = ['own', 'tribunal'].filter(k => d.pr[k].project).map(k => `<a href="${esc(d.pr[k].project.repo)}" rel="noopener" class="mono" style="font-size:13px">${k === 'own' ? 'own' : 'tribunal'}</a>`).join(' · ');
    return `<tr><td>${who(d.p)}</td><td>${projStat(st(d, 'own'), d.pr.own)}</td><td>${projStat(st(d, 'tribunal'), d.pr.tribunal)}</td><td class="m">${last ? esc(fmtDay(last.at)) : '–'}</td><td>${links}</td></tr>`;
  }).join('');
  return `<div class="wrap page">${head('reviewer --report', 'Submit projects', `Repository checks for ${scope(ctx)}. ${agS('reviewer')} checks the repositories, and you grade the work.`, groupSwitch(ctx))}
   ${tiles([['individual projects submitted', `${ownSub}<small> of ${n}</small>`], ['individual projects passing', `${ownPass}<small> of ${ownSub}</small>`, 'every check passed'], ['tribunals submitted', `${trSub}<small> of ${n}</small>`], ['tribunals passing', `${trPass}<small> of ${trSub}</small>`, 'every check passed']])}
   <div class="cols section" style="align-items:flex-start"><div class="card" style="--b:440px;flex:999 1 440px"><p class="ch">most common failed checks <span class="r">latest check of each repository</span></p>${fl.length ? hbars(fl.slice(0, 7).map(([t, v], i) => ({ l: t, v, w: i === 0 })), { max: fl[0][1], fmt: v => v }) : '<p class="fg2" style="margin:0">No failed checks so far.</p>'}</div>
   <div class="card flat" style="flex:1 1 320px"><p class="ch">note from @reviewer</p><p class="fg2" style="margin:0">${top ? `The check "${esc(top[0])}" failed or warned in ${top[1]} repositor${top[1] > 1 ? 'ies' : 'y'}, more than any other check. A short demonstration in class could help before the next round of checks.` : 'There is nothing to report yet. The note appears after the first checks.'}</p></div></div>
   <div class="section card" style="padding:6px 0"><div class="scroll"><table class="tbl"><thead><tr><th>student</th><th>individual project</th><th>tribunal</th><th>last check</th><th>repositories</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No students in this group yet.</td></tr>'}</tbody></table></div></div></div>`;
}

// ---------- Exam finale ----------
export function tExam(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const cr = M.classRows(g.id);
  const n = cr.rows.length;
  const ready = cr.rows.filter(r => r.ready.met >= 5).length, nearly = cr.rows.filter(r => r.ready.met >= 3 && r.ready.met < 5).length, notyet = n - ready - nearly;
  const conds = cr.rows[0] ? cr.rows[0].ready.conds.map((c, i) => ({ title: c.title, met: cr.rows.filter(r => r.ready.conds[i].state === 'ok').length })) : [];
  const v = k => esc(setting(k, ''));
  const field = (k, id, label, ph) => `<div><label class="f" for="${id}">${label}</label><input class="inp" id="${id}" name="${k}" value="${v(k)}" placeholder="${ph}" maxlength="80"></div>`;
  return `<div class="wrap page">${head('examiner --report', 'Exam finale', `Readiness of the class and the exam settings · ${scope(ctx)}. ${agS('examiner')} prepares and runs the exam; you approve it and grade it.`, '<span class="sample">draft format</span>' + groupSwitch(ctx))}
   <div class="cols" style="align-items:flex-start"><div class="card" style="--b:380px"><p class="ch">readiness of the class <span class="r">${n} students</span></p>
    ${cols([{ l: 'ready', v: ready, tip: `Ready: 5 or 6 of 6 conditions met\n${ready} students` }, { l: 'nearly', v: nearly, tip: `Nearly ready: 3 or 4 conditions met\n${nearly} students`, c: 'var(--seq4)' }, { l: 'not yet', v: notyet, tip: `Not yet: 2 or fewer conditions met\n${notyet} students`, c: 'var(--seq2)' }], { h: 180, aria: 'Students by exam readiness' })}</div>
   <div class="card" style="--b:380px"><p class="ch">conditions <span class="r">students who meet each</span></p>${conds.map(c => `<div class="li"><div class="t"><b style="font-size:15px">${esc(c.title)}</b></div><span class="mono small">${c.met} of ${n}</span></div>`).join('') || '<p class="fg2" style="margin:0">No students yet.</p>'}<p class="note">These are the draft conditions of the specification. Changing them from this page is not built yet.</p></div></div>
   <div class="cols section" style="align-items:flex-start"><form method="post" action="/teacher/exam/settings" class="card" style="--b:420px">${hidden(ctx)}<p class="ch">exam settings <span class="r">students see these on the exam page</span></p><div class="cols" style="--b:200px;gap:14px">
    ${field('exam_date', 'ed', 'date and time', '[date and time]')}${field('exam_length', 'el', 'length', '[duration]')}${field('exam_where', 'ew', 'where', '[in class or online]')}${field('exam_weightA', 'ea', 'part A weight', '[%]')}${field('exam_weightB', 'eb', 'part B weight', '[%]')}</div>
    <p class="ch" style="margin-top:18px">parts of the grade <span class="r">shown on My program</span></p><div class="cols" style="--b:150px;gap:14px">${field('weight_live', 'wl', 'live exercises', '[%]')}${field('weight_own', 'wo', 'individual project', '[%]')}${field('weight_tribunal', 'wt', 'tribunal', '[%]')}${field('weight_exam', 'wx', 'final exam', '[%]')}</div>
    <button class="btn pri" type="submit" style="margin-top:16px">Save settings</button></form>
   <div class="stack" style="--b:340px"><div class="card dash"><p class="ch">part A and practice exams</p><p class="fg2" style="margin:0">${agS('examiner')} will draft the closed questions of part A for your review and run practice exams on the modules taught so far. This part of the site is not built yet, so students see "practice exams open later".</p></div></div></div></div>`;
}

// ---------- Class progress ----------
export function tProgress(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const cr = M.classRows(g.id);
  const prog = programme(g.programme);
  const rows = cr.rows;
  const n = rows.length + cr.notRegistered.length;
  const engs = rows.map(r => r.live.eng).filter(v => v != null);
  const avgs = M.groupLessonAverages(cr.matrix);
  const score = M.avg(avgs.map(a => a.score));
  const sorted = rows.map(r => r.studied).sort((a, b) => a - b);
  const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const ownPass = rows.filter(r => r.own === 'passed').length, ready = rows.filter(r => r.ready.met >= 5).length;
  const exam = hasExam(g.programme);
  const flagged = rows.filter(r => r.flag);
  const labels = cr.matrix.lessons.map(l => `L${l.number}`);
  const tips = cr.matrix.lessons.map(l => `Lesson ${l.number}, ${lessonTitle(g.programme, l)}`);
  const bands = [['under 50%', 0, 49], ['50–69%', 50, 69], ['70–84%', 70, 84], ['85–100%', 85, 100]].map((b, i) => { const k = engs.filter(e => e >= b[1] && e <= b[2]).length; return { l: b[0], v: k, tip: `${b[0]} of live exercises answered\n${k} students`, c: ['var(--seq2)', 'var(--seq3)', 'var(--seq4)', 'var(--seq5)'][i] }; });
  const mc = prog.modules.map(m => {
    const has = moduleContent(g.programme, m.n);
    const k = rows.filter(r => r.prac[m.n] && r.prac[m.n].studied).length;
    return { l: String(m.n), v: rows.length ? Math.round((k / rows.length) * 100) : 0, show: false, tip: `Module ${m.n}: ${m.title}\n${has ? `${k} of ${rows.length} students studied it` : 'no study page yet'}` };
  });
  const onlyFlagged = ctx.query.flagged === '1';
  const list = onlyFlagged ? flagged : rows;
  const tr = list.map(r => `<tr><td>${who(r.user)}${r.flag ? ' <span class="chip warn" style="margin-left:6px">flag</span>' : ''}</td><td>${r.live.eng == null ? '–' : `<span class="mini"><i><b style="width:${r.live.eng}%"></b></i><span class="mono" style="font-size:13px">${r.live.eng}%</span></span>`}</td><td class="m">${r.live.score == null ? '–' : r.live.score + '%'}</td><td class="m">${r.practice == null ? '–' : Math.round(r.practice) + '%'}</td><td class="m">${r.studied} / ${prog.modules.length}</td><td>${projStat(r.own, r.projs.own)}</td><td>${projStat(r.trib, r.projs.tribunal)}</td>${exam ? `<td class="m">${r.ready.met} / ${r.ready.conds.length}</td>` : ''}<td>${trendIc(r.trend)}</td></tr>`).join('')
    + (onlyFlagged ? '' : cr.notRegistered.map(p => `<tr><td>${who(p, null)}</td><td colspan="${exam ? 8 : 7}" class="muted" style="font-size:14px">Not registered on the site yet</td></tr>`).join(''));
  const pctFmt = { type: 'line', labels, tips, min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: 'pct' };
  return `<div class="wrap page">${head('analyst --class', 'Class progress', `${scope(ctx)} · ${n} students · ${cr.held} lesson${cr.held === 1 ? '' : 's'} held`, groupSwitch(ctx) + ag('analyst'))}
   ${tiles([['live exercises answered', engs.length ? Math.round(M.avg(engs)) + '%' : '–', 'average of registered students'], ['live exercise score', score == null ? '–' : Math.round(score) + '%', labels.length ? `lessons ${cr.matrix.lessons[0].number} to ${cr.matrix.lessons[cr.matrix.lessons.length - 1].number}` : 'no lessons yet'], ['modules studied', `${med}<small> of ${prog.modules.length}</small>`, 'median student'], ['individual projects passing', `${ownPass}<small> of ${n}</small>`],  ...(exam ? [['exam ready', `${ready}<small> of ${n}</small>`, '5 or 6 conditions met']] : []), ['flagged by @analyst', String(flagged.length), 'need your attention', flagged.length ? 'down' : '']])}
   ${labels.length ? `<div class="cols section"><div class="card" style="--b:380px"><p class="ch">live exercises answered <span class="r">per lesson</span></p>${chart({ ...pctFmt, aria: 'Share of live exercises answered by the class, per lesson.', series: [{ name: 'Answered', values: avgs.map(a => a.answeredRate), color: '#3DDC97' }] }, 210)}</div><div class="card" style="--b:380px"><p class="ch">live exercise score <span class="r">per lesson</span></p>${chart({ ...pctFmt, aria: 'Average live exercise score of the class, per lesson.', series: [{ name: 'Average score', values: avgs.map(a => a.score), color: '#3DDC97' }] }, 210)}</div></div>` : ''}
   <div class="cols section"><div class="card" style="--b:300px"><p class="ch">students by live engagement</p>${cols(bands, { h: 180, aria: 'Students by share of live exercises answered' })}</div><div class="card" style="--b:440px;flex:999 1 440px"><p class="ch">modules studied by the class <span class="r">% of students</span></p>${cols(mc, { h: 180, max: 100, aria: 'Share of students who studied each module' })}<p class="note">A module counts as studied when every practice exercise on its study page is done.</p></div></div>
   <div class="section card"><p class="ch">flags from @analyst <span class="r">${flagged.length} students</span></p>${flagged.slice(0, 8).map(r => `<div class="li"><div class="t"><b style="font-size:14px">${who(r.user)}</b><span>${esc(r.flag)}</span></div>${r.user.role === 'student' ? `<a class="btn sec" style="min-height:40px;font-size:14px" href="mailto:${esc(r.user.email)}?subject=${encodeURIComponent(prog.title)}">Write</a>` : ''}</div>`).join('') || '<p class="fg2" style="margin:0">No student is flagged.</p>'}</div>
   <div class="section"><div class="sechead"><h2 class="h2">Students</h2><div class="row"><a class="tog" aria-pressed="${onlyFlagged}" href="/teacher/progress${gq(ctx)}${onlyFlagged ? '' : '&flagged=1'}">show flagged only</a><a class="btn out" href="/teacher/export.csv${gq(ctx)}">export CSV for Moodle</a></div></div><div class="card" style="padding:6px 0"><div class="scroll"><table class="tbl" style="min-width:940px"><thead><tr><th>student</th><th>answered</th><th>score</th><th>practice</th><th>modules</th><th>individual project</th><th>tribunal</th>${exam ? '<th>exam</th>' : ''}<th>trend</th></tr></thead><tbody>${tr || '<tr><td colspan="9" class="muted">No students to show.</td></tr>'}</tbody></table></div></div></div></div>`;
}

// The Moodle export has 2 columns, and Moodle matches each row by email.
export function exportCsv(ctx) {
  const cr = M.classRows(ctx.group.id);
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lines = ['email,engagement', ...cr.rows.filter(r => r.user.role === 'student').map(r => `${q(r.user.email)},${r.live.eng == null ? '' : r.live.eng}`)];
  return lines.join('\r\n') + '\r\n';
}

// ---------- Satisfaction ----------
function heatColor(v) {
  const i = v < 3 ? 0 : v < 3.5 ? 1 : v < 4 ? 2 : v < 4.5 ? 3 : 4;
  return `${['var(--seq1)', 'var(--seq2)', 'var(--seq3)', 'var(--seq4)', 'var(--seq5)'][i]};color:${i >= 3 ? 'var(--accent-ink)' : 'var(--fg)'}`;
}

function findings(s, g) {
  const out = [];
  const shown = s.lessons.filter(l => l.shown);
  if (!shown.length) return ['No lesson has 5 ratings yet. The report fills in once 5 students have rated a lesson.'];
  if (s.first != null && s.last != null) {
    const half = Math.ceil(shown.length / 2);
    const a = `lessons ${shown[0].number} to ${shown[half - 1].number}`, b = `lessons ${shown[half].number} to ${shown[shown.length - 1].number}`;
    out.push(s.last < s.first - 0.05 ? `Satisfaction has slipped a little. ${a[0].toUpperCase() + a.slice(1)} averaged ${r1(s.first)} of 5, and ${b} averaged ${r1(s.last)}.` : s.last > s.first + 0.05 ? `Satisfaction has risen. ${a[0].toUpperCase() + a.slice(1)} averaged ${r1(s.first)} of 5, and ${b} averaged ${r1(s.last)}.` : `Satisfaction is steady at about ${r1(s.avgRating)} of 5.`);
  }
  if (s.dims) {
    const low = [...s.dims].filter(d => d.v != null).sort((a, b) => a.v - b.v).slice(0, 2);
    const strong = low.filter(d => d.imp != null && d.imp >= 0.5);
    if (low.length === 2) out.push(`${low[0].label} and ${low[1].label.toLowerCase()} are the 2 weakest dimensions${strong.length === 2 ? ', and they move the overall rating most. Work on these 2 first.' : '.'}`);
    const moved = s.dims.filter(d => d.prev != null).sort((a, b) => Math.abs(b.v - b.prev) - Math.abs(a.v - a.prev))[0];
    if (moved && Math.abs(moved.v - moved.prev) >= 0.2) out.push(`${moved.label} ${moved.v > moved.prev ? 'rose' : 'fell'} from ${r1(moved.prev)} to ${r1(moved.v)} between the 2 latest surveys.`);
  }
  const lowest = [...shown].sort((a, b) => a.avg - b.avg)[0];
  if (shown.length >= 3) {
    const tally = all("SELECT blocked FROM lesson_ratings WHERE lesson_id = ?", lowest.id).flatMap(r => JSON.parse(r.blocked || '[]'));
    const top = Object.entries(tally.reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
    out.push(`Lesson ${lowest.number} got the lowest rating, ${r1(lowest.avg)}${top && top[1] >= M.MIN_GROUP ? `, and the most common answer to what got in the way was "${top[0].toLowerCase()}"` : ''}.`);
  }
  return out;
}

export function tSatisfaction(ctx) {
  const g = ctx.group;
  if (!g) return noGroup();
  const s = M.satisfaction(g.id);
  const shown = s.lessons.filter(l => l.shown);
  const rangeTxt = s.lessons.length ? `Lessons ${s.lessons[0].number} to ${s.lessons[s.lessons.length - 1].number}` : 'No lessons held yet';
  const weakest = s.dims ? [...s.dims].filter(d => d.v != null).sort((a, b) => a.v - b.v)[0] : null;
  const themesSaved = (() => { try { return JSON.parse(setting(`themes:${g.id}`, 'null')); } catch { return null; } })();
  const survey = M.openSurvey(g.id);
  const surveyAnswers = survey ? get('SELECT COUNT(*) AS n FROM survey_answers WHERE survey_id = ?', survey.id).n : 0;
  const half = Math.ceil(shown.length / 2);
  const avgTxt = s.first != null ? `lessons ${shown[half].number}–${shown[shown.length - 1].number}: ${r1(s.last)}, lessons ${shown[0].number}–${shown[half - 1].number}: ${r1(s.first)}` : '';

  const vals = s.lessons.map(l => (l.shown ? l.avg : null));
  const minV = Math.min(...vals.filter(v => v != null), 5);
  const lo = Math.max(1, Math.floor((minV - 0.3) * 2) / 2);
  const ticks = []; for (let t = lo; t <= 5.0001; t += (5 - lo) > 2 ? 1 : 0.5) ticks.push(Math.round(t * 10) / 10);
  const trend = shown.length ? chart({ type: 'line', labels: s.lessons.map(l => `L${l.number}`), tips: s.lessons.map(l => `Lesson ${l.number}\n${l.n} of ${s.size} rated${l.shown ? '' : '\nfewer than 5 ratings, not shown'}`), min: lo, max: 5, ticks, fmt: 'r1', aria: 'Average lesson rating per lesson.', series: [{ name: 'Lesson rating', values: vals, color: '#3DDC97' }, { name: 'Course average', values: s.lessons.map(() => s.avgRating), color: '#8B949E', dash: true }] }) : '<p class="fg2" style="margin:0">The chart appears when a lesson has 5 ratings.</p>';

  const resp = cols(s.lessons.map(l => ({ l: `L${l.number}`, v: l.rate || 0, tip: `Lesson ${l.number}\n${l.n} of ${s.size} rated (${l.rate || 0}%)` })), { h: 200, max: 100, fmt: v => v, aria: 'Response rate per lesson' });
  const dimsCard = s.dims
    ? `${s.earlier ? '<div class="legend"><span><i class="sq"></i>latest survey</span><span><i style="width:2px;height:14px;background:var(--fg2)"></i>earlier survey</span></div>' : ''}${hbars(s.dims.map(d => ({ l: d.label, v: d.v, p: d.prev, w: d.v != null && d.v < 3.5, tip: `${d.label}\nlatest ${r1(d.v)}${d.prev != null ? ` · earlier ${r1(d.prev)}` : ''}` })), { min: 1, max: 5, fmt: v => r1(v) })}<p class="note">Scale from 1 to 5. Yellow bars are below 3.5.</p>`
    : '<p class="fg2" style="margin:0">The dimensions appear when a survey has 5 answers.</p>';
  const pts = s.dims ? s.dims.filter(d => d.v != null && d.imp != null).map(d => ({ label: d.label, x: d.v, y: d.imp })) : [];
  const drivers = pts.length >= 3 ? chart({ type: 'scatter', points: pts, aria: 'Importance and score of the satisfaction dimensions.' }, 320) + '<p class="note">Importance is how strongly each dimension moves with the overall rating. Dimensions in the shaded corner matter most and score lowest.</p>' : '<p class="fg2" style="margin:0">The chart appears when a survey has enough answers to compare the dimensions.</p>';
  const modRows = s.modules.length ? `<div class="heat" style="grid-template-columns:minmax(120px,2.4fr) minmax(70px,1fr) minmax(70px,1fr)"><span></span><span class="hd">clarity</span><span class="hd">answers</span>${s.modules.map(m => { const t = moduleTitle(g.programme, m.module); return `<span class="rl"><span><span class="mono muted">${pad(m.module)}</span> ${esc(t.length > 34 ? t.slice(0, 32) + '…' : t)}</span></span>${m.avg != null ? `<span class="cell" style="background:${heatColor(m.avg)}" data-tip="${esc(`Module ${m.module}: ${t}\nclarity ${r1(m.avg)} of 5`)}">${r1(m.avg)}</span>` : '<span class="cell" style="background:var(--line2);color:var(--muted)">–</span>'}<span class="cell mono" style="color:var(--muted)">${m.n}</span>`; }).join('')}</div><div class="heatkey"><span><i style="background:var(--seq1)"></i>under 3.0</span><span><i style="background:var(--seq2)"></i>3.0–3.4</span><span><i style="background:var(--seq3)"></i>3.5–3.9</span><span><i style="background:var(--seq4)"></i>4.0–4.4</span><span><i style="background:var(--seq5)"></i>4.5 and over</span></div><p class="note">A module shows its clarity once 5 students have rated it.</p>` : '<p class="fg2" style="margin:0">No module has been rated yet.</p>';
  const rec = s.recommend ? `<div class="legend"><span><i class="sq" style="background:var(--bad)"></i>detractors 0–6</span><span><i class="sq" style="background:#8B949E"></i>passives 7–8</span><span><i class="sq"></i>promoters 9–10</span></div>${cols(s.recommend.dist.map((k, i) => ({ l: String(i), v: k, c: i <= 6 ? 'var(--bad)' : i <= 8 ? '#8B949E' : 'var(--accent)', tip: `Score ${i}: ${k} students\n${i <= 6 ? 'detractor' : i <= 8 ? 'passive' : 'promoter'}` })), { h: 170, fmt: v => v || '', aria: 'Answers to would you recommend the course, from 0 to 10' })}<p class="note">Recommend score ${s.recommend.score > 0 ? '+' : ''}${s.recommend.score}: ${s.recommend.prom}% promoters minus ${s.recommend.det}% detractors.</p>` : '<p class="fg2" style="margin:0">The recommend score appears when a survey has 5 answers.</p>';

  let themes;
  if (s.comments.length < M.MIN_GROUP) themes = `<p class="fg2" style="padding:0 20px 16px;margin:0">${s.commentCount ? `There are ${s.commentCount} written comments. They are shown once there are 5 or more.` : 'No written comments yet.'}</p>`;
  else if (themesSaved && themesSaved.themes) {
    const cmax = Math.max(...themesSaved.themes.map(t => t.count || 0), 1);
    const toneMap = { positive: ['ok', 'positive'], negative: ['bad', 'negative'], request: ['warn', 'request'] };
    themes = `<div class="scroll"><table class="tbl" style="min-width:820px"><thead><tr><th>theme</th><th>comments</th><th>tone</th><th>example comment</th></tr></thead><tbody>${themesSaved.themes.map(t => `<tr><td style="font-weight:700">${esc(t.theme)}</td><td><span class="mini"><i><b style="width:${((t.count || 0) / cmax) * 100}%"></b></i><span class="mono" style="font-size:13px">${t.count}</span></span></td><td>${stat(...(toneMap[t.tone] || ['none', t.tone || '']))}</td><td class="fg2" style="font-size:14px">“${esc(t.example)}”</td></tr>`).join('')}</tbody></table></div><p class="small" style="padding:10px 20px">Grouped ${esc(fmtDate(themesSaved.at))} from ${themesSaved.n} comments.</p>`;
  } else themes = `<div style="padding:0 20px 16px">${s.comments.slice(-20).reverse().map(c => `<p class="fg2" style="margin:0 0 8px;font-size:14.5px">“${esc(c.text)}” <span class="mono small">lesson ${c.lesson}</span></p>`).join('')}</div>`;
  const themeBtn = s.comments.length >= M.MIN_GROUP ? (aiAvailable() ? `<form method="post" action="/teacher/satisfaction/themes" class="inline" style="padding:0 20px 16px;display:block">${hidden(ctx)}<button class="btn out" type="submit">${themesSaved ? 'group the comments again' : 'group the comments into themes'}</button></form>` : '<p class="small" style="padding:0 20px 16px">Grouping comments into themes needs ANTHROPIC_API_KEY in the pod. Until then, the latest comments are listed.</p>') : '';

  const surveyCard = survey
    ? `<form method="post" action="/teacher/satisfaction/survey" class="card hl">${hidden(ctx)}<input type="hidden" name="survey" value="${survey.id}"><p class="ch">${esc(survey.label)} <span class="r">open since ${esc(fmtDay(survey.opened_at))}</span></p><p style="margin:0 0 6px;font-size:28px;font-weight:800;line-height:1">${surveyAnswers} <span style="font-size:16px;color:var(--muted);font-weight:600">of ${s.size} answered</span></p><p class="fg2" style="margin:0 0 14px;font-size:15px">Students see the survey on the Learn in class page until you close it.</p><button class="btn sec" name="action" value="close">Close the survey</button></form>`
    : `<form method="post" action="/teacher/satisfaction/survey" class="card">${hidden(ctx)}<input type="hidden" name="action" value="open"><p class="ch">course survey</p><p class="fg2" style="margin:0 0 12px;font-size:15px">Open the survey of 6 dimensions twice in the program, at the start and in the middle.</p><label class="f" for="sl">name</label><select class="inp" id="sl" name="label"><option>First survey</option><option>Mid-course survey</option><option>End-of-course survey</option></select><button class="btn pri" style="margin-top:12px">Open the survey</button></form>`;

  return `<div class="wrap page">${head('analyst --satisfaction', 'Student satisfaction', `${rangeTxt} · ${scope(ctx)} · ${s.size} students. Ratings are anonymous and shown only for groups of 5 or more.`, groupSwitch(ctx) + ag('analyst'))}
   ${tiles([['satisfaction index', s.index == null ? '–' : `${s.index}<small> of 100</small>`, 'from lesson ratings'], ['average lesson rating', s.avgRating == null ? '–' : `${r1(s.avgRating)}<small> of 5</small>`, avgTxt, s.last != null && s.last < s.first ? 'down' : ''], ['response rate', s.responseRate == null ? '–' : `${s.responseRate}%`, 'of possible lesson ratings'], ['recommend score', s.recommend ? `${s.recommend.score > 0 ? '+' : ''}${s.recommend.score}` : '–', s.recommend ? `${s.recommend.prom}% promoters · ${s.recommend.det}% detractors` : 'from the latest survey'], ['weakest dimension', weakest ? esc(weakest.label) : '–', weakest ? `${r1(weakest.v)} of 5${weakest.prev != null ? `, ${weakest.v < weakest.prev ? 'down' : 'up'} from ${r1(weakest.prev)}` : ''}` : 'from the latest survey', weakest && weakest.prev != null && weakest.v < weakest.prev ? 'down' : ''], ['written comments', String(s.commentCount), themesSaved && themesSaved.themes ? `${themesSaved.themes.length} themes found by @analyst` : '']])}
   <div class="cols section" style="align-items:flex-start"><div class="card hl" style="--b:460px;flex:999 1 460px"><p class="ch">what @analyst found</p><div class="stack" style="gap:10px">${findings(s, g).map((t, i) => `<p class="row" style="flex-wrap:nowrap;align-items:flex-start;margin:0;font-size:15.5px"><span class="chip" style="flex:0 0 auto">${i + 1}</span><span class="fg2">${esc(t)}</span></p>`).join('')}</div></div><div style="flex:1 1 300px">${surveyCard}</div></div>
   <div class="cols section"><div class="card" style="--b:440px;flex:999 1 440px"><p class="ch">lesson rating <span class="r">average of 1 to 5</span></p>${shown.length ? `<div class="legend"><span><i></i>Lesson rating</span><span><i class="ref"></i>Course average ${r1(s.avgRating)}</span></div>` : ''}${trend}
    ${s.lessons.length ? `<details class="data"><summary>show as a table</summary><div class="scroll"><table class="tbl"><thead><tr><th>lesson</th><th>rating</th><th>answers</th></tr></thead><tbody>${s.lessons.map(l => `<tr><td class="m">${l.number}</td><td class="m">${l.shown ? r1(l.avg) : 'fewer than 5'}</td><td class="m">${l.n} of ${s.size}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</div>
   <div class="card" style="flex:1 1 320px"><p class="ch">response rate <span class="r">% of the class</span></p>${s.lessons.length ? resp : '<p class="fg2" style="margin:0">No lessons held yet.</p>'}<p class="note">Below 60% a lesson's rating is uncertain.</p></div></div>
   <div class="cols section"><div class="card" style="--b:420px"><p class="ch">dimensions <span class="r">${s.latest ? `${esc(s.latest.label.toLowerCase())} · ${s.latest.n} answers` : 'course survey'}</span></p>${dimsCard}</div>
   <div class="card" style="--b:420px"><p class="ch">what drives satisfaction <span class="r">importance against score</span></p>${drivers}</div></div>
   <div class="cols section"><div class="card" style="--b:440px;flex:999 1 440px"><p class="ch">ratings by module <span class="r">clarity, from the study pages</span></p>${modRows}</div>
   <div class="card" style="flex:1 1 320px"><p class="ch">would recommend the course <span class="r">0 to 10${s.recommend ? ` · ${s.recommend.n} answers` : ''}</span></p>${rec}</div></div>
   <div class="section card" style="padding:6px 0"><p class="ch" style="padding:16px 20px 0">${themesSaved && themesSaved.themes && s.comments.length >= M.MIN_GROUP ? 'themes in written comments' : 'written comments'} <span class="r">${s.commentCount} comments${themesSaved && themesSaved.themes ? ' · grouped by @analyst' : ''}</span></p>${themes}${themeBtn}</div>
   <div class="section card flat"><p class="ch">how satisfaction is measured</p><div class="cols" style="--b:220px;gap:18px">
   ${[['After each lesson', 'A rating from 1 to 5, what helped, what got in the way, and an optional comment. It takes about 20 seconds.'], ['After each module', 'A clarity rating from 1 to 5 at the end of the study page.'], ['Twice per course', 'A survey of 6 dimensions and the question whether the student would recommend the course.'], ['Privacy', 'All answers are anonymous. You see results only from 5 or more students, and no answer affects a grade.']].map(x => `<div><p style="margin:0 0 4px;font-weight:800">${x[0]}</p><p class="fg2" style="margin:0;font-size:14.5px">${x[1]}</p></div>`).join('')}
   </div></div></div>`;
}

// ---------- Groups and access ----------
export function tAccess(ctx) {
  const groups = M.groupsAll();
  const g = ctx.group;
  const real = groups.filter(x => !x.is_demo);
  const demoG = groups.find(x => x.is_demo);
  const counts = id => get(`SELECT COUNT(*) AS permitted, SUM(CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) AS registered FROM permitted p LEFT JOIN users u ON u.email = p.email WHERE p.group_id = ?`, id);
  const cards = real.map(x => { const c = counts(x.id); return `<a class="card" href="/teacher/access?group=${x.id}" style="text-decoration:none;color:inherit${g && g.id === x.id ? ';border-color:var(--accent-line)' : ''}"><p class="ch">${esc(programme(x.programme).title.toLowerCase())} <span class="r">${g && g.id === x.id ? 'shown below' : 'show'}</span></p><p style="margin:0 0 4px;font-weight:800;font-size:18px">${esc(M.groupLabel(x))}</p><p class="small" style="margin:0 0 10px">${esc(x.institution)}</p><p class="mono small" style="margin:0">${c.permitted} permitted · ${c.registered || 0} registered</p></a>`; }).join('');
  const demoVisits = get("SELECT COUNT(*) AS n, MAX(at) AS last FROM demo_visits WHERE path = '/auth/demo' AND at >= ?", new Date(Date.now() - 30 * 864e5).toISOString());
  const demoCard = demoG ? `<a class="card dash" href="/teacher/access?group=${demoG.id}" style="text-decoration:none;color:inherit"><p class="ch" style="color:var(--warn)">demo <span class="r">sample group</span></p><p style="margin:0 0 4px;font-weight:800;font-size:18px">${esc(demoG.institution)} · group ${esc(demoG.code)}</p><p class="small" style="margin:0 0 10px">${esc(programme(demoG.programme).title)}</p><p class="mono small" style="margin:0">1 demo login · reset every night</p></a>` : '';
  const progs = ['ase'];
  const permitted = g && !g.is_demo ? M.permittedOf(g.id) : [];
  const rows = permitted.map(p => `<tr><td>${who(p, p.user_id)}</td><td>${p.user_id ? stat('ok', `registered ${fmtDay(p.registered_at)}`) : stat('warn', 'not registered')}</td><td class="m">${p.last_seen ? esc(fmtDay(p.last_seen)) : '–'}</td><td><form method="post" action="/teacher/access/remove" class="inline" data-confirm="Remove ${esc(p.email)} from the list? The student can no longer sign in. Their answers stay.">${hidden(ctx)}<input type="hidden" name="email" value="${esc(p.email)}"><button class="linkbtn mono" style="font-size:12.5px;color:var(--muted)">remove</button></form></td></tr>`).join('');
  const refused = all('SELECT email, MAX(at) AS at, COUNT(*) AS n FROM refused WHERE handled = 0 GROUP BY email ORDER BY at DESC LIMIT 20');
  const groupOptions = real.map(x => `<option value="${x.id}"${g && g.id === x.id ? ' selected' : ''}>${esc(M.groupLabel(x))}</option>`).join('');
  const msgs = all('SELECT * FROM messages WHERE handled = 0 ORDER BY at DESC');
  return `<div class="wrap page">${head('registrar --access', 'Groups and access', `A student can register only with an address on this list. The site places each student in the institution, group and program written beside the address. ${agS('registrar')} checks every registration against the list.`)}
   <div class="cols" style="--b:280px">${cards}${demoCard}</div>
   <form method="post" action="/teacher/access/permit" class="card section" data-csv-form>${hidden(ctx)}<p class="ch">permit addresses</p><div class="cols" style="gap:16px;align-items:flex-start">
    <div style="--b:320px;flex:999 1 320px"><label class="f" for="pa">email addresses, one per line</label><textarea class="inp" id="pa" name="emails" rows="5" placeholder="name@gmail.com"></textarea><textarea name="csv" hidden data-csv-text></textarea><p class="small" data-csv-status style="margin-top:6px"></p></div>
    <div class="stack" style="--b:280px;gap:14px"><div><label class="f" for="pi">institution</label><input class="inp" id="pi" name="institution" maxlength="120" value="${esc(g && !g.is_demo ? g.institution : 'Holon Institute of Technology')}"></div><div><label class="f" for="pg">group</label><input class="inp" id="pg" name="code" maxlength="40" placeholder="62121-31" value="${esc(g && !g.is_demo ? g.code : '')}"></div><div><label class="f" for="pp">program</label><select class="inp" id="pp" name="programme">${progs.map(p => `<option value="${p}">${esc(programme(p).title)}</option>`).join('')}</select></div></div></div>
    <div class="row" style="margin-top:16px"><button type="submit" class="btn pri">Add to the list</button><label class="btn sec" for="pf" style="cursor:pointer">Upload a CSV</label><input type="file" id="pf" accept=".csv,text/csv" class="sr" data-csv-file><span class="small">From a CSV file the site reads only 5 columns: first name, last name, email, group and institution. It never imports ID numbers. A group or institution in the file overrides the one above. Where a name is missing, it comes from the student’s Google account, and each student can change their name on My account.</span></div></form>
   ${g && !g.is_demo ? `<div class="card section" style="padding:0"><div class="row" style="justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line)"><h2 class="h3" style="margin:0">Permitted addresses · ${esc(M.groupLabel(g))}</h2><a class="btn out" href="/teacher/export.csv${gq(ctx)}">export CSV for Moodle</a></div>
    <div class="scroll"><table class="tbl" style="min-width:640px"><thead><tr><th>email</th><th>status</th><th>last sign-in</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No addresses yet.</td></tr>'}</tbody></table></div><p class="small" style="padding:12px 20px">${permitted.length} addresses. The Moodle export has 2 columns, the email address and the engagement figure, and Moodle matches each row by email.</p></div>` : ''}
   <div class="cols section" style="align-items:flex-start">
   <div class="card warnb" style="--b:380px"><p class="ch" style="color:var(--warn)">refused registrations <span class="r">not on any list</span></p>${refused.map(x => `<div class="li"><div class="t"><b class="mono" style="font-size:14px">${esc(x.email)}</b><span>tried ${x.n > 1 ? `${x.n} times, last ` : ''}${esc(fmtDate(x.at))}</span></div><form method="post" action="/teacher/access/refused" class="row">${hidden(ctx)}<input type="hidden" name="email" value="${esc(x.email)}">${real.length ? `<label class="sr" for="rg${x.at}">group</label><select class="inp" name="to" style="min-height:38px;width:auto;font-size:13.5px">${groupOptions}</select><button class="btn out" style="min-height:38px" name="action" value="add">add to the group</button>` : ''}<button class="btn sec" style="min-height:38px;font-size:14px" name="action" value="ignore">Ignore</button></form></div>`).join('') || '<p class="fg2" style="margin:0">No refused registrations wait for you.</p>'}</div>
   <div class="card" style="--b:380px"><p class="ch">demo logins</p><div class="scroll"><table class="tbl" style="min-width:420px"><thead><tr><th>login</th><th>programme</th><th>last used</th><th>last 30 days</th></tr></thead><tbody><tr><td class="m">demo</td><td>${demoG ? esc(programme(demoG.programme).title) : '–'}</td><td class="m">${demoVisits.last ? esc(fmtDay(demoVisits.last)) : '–'}</td><td class="m">${demoVisits.n} sign-ins</td></tr></tbody></table></div>
    <form method="post" action="/teacher/access/demo-reset" class="row" style="margin-top:14px">${hidden(ctx)}<button class="btn sec" style="min-height:40px;font-size:14px">Reset the demo group now</button></form>
    <p class="note">A demo login is a sample student. It sees only the student side, and the demo group is reset every night at 03:00. The password is the secret DEMO_PASSWORD in the pod${'’'}s Secrets panel.</p></div></div>
   <div class="section"><div class="sechead"><h2 class="h2">Messages from Contact SAW</h2><span class="mono small">${msgs.length} waiting · passed by @steward</span></div><div class="stack" style="gap:12px">
   ${msgs.map(x => `<article class="card row" style="justify-content:space-between;align-items:center;gap:14px 24px"><div style="flex:999 1 420px;min-width:0"><p class="row" style="gap:6px 14px;margin:0 0 4px"><b style="font-size:16px">${esc(x.name || x.email)}</b><span class="chip">${esc(x.topic || '')}</span><span class="mono small">${esc(fmtDate(x.at))}</span></p><p class="mono small" style="margin:0 0 6px">${esc(x.email)}</p><p class="fg2" style="margin:0;font-size:15px;white-space:pre-wrap">${esc(x.body)}</p></div><div class="row" style="flex:1 1 260px;justify-content:flex-end"><a class="btn pri" href="mailto:${esc(x.email)}?subject=${encodeURIComponent('School of Agentic Work: ' + (x.topic || 'your message'))}">Reply</a><form method="post" action="/teacher/access/message" class="inline">${hidden(ctx)}<input type="hidden" name="id" value="${x.id}"><button class="btn sec">Mark as handled</button></form></div></article>`).join('') || '<p class="fg2">No messages wait for you.</p>'}
   </div></div></div>`;
}

// ---------- Agents ----------
const PERMS = {
  steward: ['assign tasks, pass on messages, write the daily brief', 'nothing; it only reports'],
  registrar: ['check registrations, place students in groups', 'add an address to the list'],
  proctor: ['open and time exercises in the demo group, record answers', 'release an exercise, show results'],
  tutor: ['answer from the rules and the materials', 'answer a question outside the rules'],
  reviewer: ['run checks, write feedback', 'nothing; it never grades'],
  examiner: ['track readiness against the conditions', 'publish an exam, change the conditions'],
  analyst: ['collect ratings, build reports, flag students', 'message a flagged student'],
};

export function tAgents(ctx) {
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const today = Object.fromEntries(all('SELECT agent, COUNT(*) AS n FROM agent_log WHERE at >= ? GROUP BY agent', day.toISOString()).map(r => [r.agent, r.n]));
  const wait = [];
  const msgs = get('SELECT COUNT(*) AS n FROM messages WHERE handled = 0').n;
  const refused = get('SELECT COUNT(DISTINCT email) AS n FROM refused WHERE handled = 0').n;
  const passed = get('SELECT COUNT(*) AS n FROM tutor_passed WHERE handled = 0').n;
  const q = ctx.group ? gq(ctx) : '';
  if (msgs) wait.push(['steward', `${msgs} message${msgs > 1 ? 's' : ''} from Contact SAW wait${msgs > 1 ? '' : 's'} for your answer`, '/teacher/access' + q]);
  if (refused) wait.push(['registrar', `${refused} address${refused > 1 ? 'es' : ''} tried to register and ${refused > 1 ? 'are' : 'is'} not on any list`, '/teacher/access' + q]);
  if (passed) wait.push(['tutor', `${passed} question${passed > 1 ? 's are' : ' is'} outside the rules`, '/teacher/study' + q]);
  for (const g of M.groupsAll().filter(x => !x.is_demo)) {
    const flagged = M.classRows(g.id).rows.filter(r => r.flag).length;
    if (flagged) wait.push(['analyst', `${flagged} student${flagged > 1 ? 's' : ''} of ${M.groupLabel(g)} ${flagged > 1 ? 'are' : 'is'} flagged`, `/teacher/progress?group=${g.id}`]);
  }
  const log = all('SELECT * FROM agent_log ORDER BY id DESC LIMIT 30');
  return `<div class="wrap page">${head('ps agents', 'Agents', 'What each agent did today and what waits for your decision.', `<span class="chip">${activeAgents().length} running</span>`)}
   <div class="card hl"><p class="ch">waiting for you <span class="r">daily brief by @steward</span></p>${wait.map(w => `<div class="li"><span class="agent" style="flex:0 0 110px">@${w[0]}</span><span class="t" style="flex:999 1 240px">${esc(w[1])}</span><a class="btn out" href="${w[2]}">open</a></div>`).join('') || '<p class="fg2" style="margin:0">Nothing waits for your decision.</p>'}</div>
   <div class="cols section" style="--b:300px">${activeAgents().map(a => { const p = PERMS[a.id]; return `<article class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row" style="justify-content:space-between"><span class="agent" style="font-size:15px">@${a.id}</span><span class="chip ok"><span class="dot"></span>running</span></div><p class="mono small" style="margin:0">${esc(a.role.toLowerCase())} · ${today[a.id] || 0} action${today[a.id] === 1 ? "" : "s"} today</p><dl class="kv" style="margin:0;font-size:14px"><dt>does alone</dt><dd>${p[0]}</dd><dt>asks you first</dt><dd>${p[1]}</dd></dl></article>`; }).join('')}</div>
   <div class="section card"><p class="ch">activity <span class="r">latest 30 actions</span></p><div class="log">${log.length ? logLines(log.map(l => [l.agent, `${fmtDate(l.at)} · ${l.text}`])) : '<p class="fg2" style="margin:0">No activity yet.</p>'}</div></div></div>`;
}
