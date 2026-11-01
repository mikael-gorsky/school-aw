// The student side: My program, the 4 sections and My progress.
// Each page has a general form for visitors, with example screens that cannot
// be used, and a form with the student's own data (decision of 31 October 2026).
import { esc, pad, I, stat, ag, agS, head, squares, exFrame, steps, signStrip, tiles, hbars, chart, fmtDate } from '../html.js';
import { programme, moduleContent, moduleTitle, hasExam, lessonTitle, lessonModules } from '../content.js';
import { setting } from '../db.js';
import { aiAvailable } from '../ai.js';
import * as M from '../model.js';
import { lessonPhase, dayLabel, timeLabel } from '../schedule.js';

const signedIn = ctx => ctx.role === 'student' || ctx.role === 'demo';
export const HELPED = ['Live exercises', 'Examples', 'Slides', 'Pace', 'Questions and answers'];
export const BLOCKED = ['Too fast', 'Too slow', 'Unclear slides', 'Sound or video', 'Too much at once'];

// ---------- building blocks used for real data and for examples ----------
export function liveCardMarkup(d) {
  const opts = d.options.map(([k, t]) => {
    const pressed = d.picked === k;
    const right = d.state === 'shown' && d.correct === k;
    const n = d.counts ? d.counts[k] || 0 : null;
    const attrs = d.interactive && d.state === 'open' ? ` data-answer="${esc(k)}" data-item="${d.itemId}"` : (d.state === 'open' ? '' : ' disabled');
    return `<button type="button" class="opt${right ? ' right' : ''}" aria-pressed="${pressed}"${attrs}><span class="k">[${esc(k.toUpperCase())}]</span><span>${esc(t)}</span>${n != null ? `<span class="count">${n}${right ? ' · correct' : ''}</span>` : ''}</button>`;
  }).join('');
  const timer = d.state === 'open' ? `<span class="r timer" style="color:var(--accent);font-size:20px;font-weight:700" data-closes="${esc(d.closesAt || '')}">${d.timerText || '02:00'}</span>` : `<span class="r">${d.state === 'shown' ? 'results' : 'closed'}</span>`;
  let foot;
  if (d.state === 'open') foot = d.picked ? `<p class="status" role="status" style="margin-top:12px"><span style="color:var(--accent)">${I.check}</span>Answer recorded. You can change it until the time runs out.</p>` : '<p class="note" style="margin-top:4px">Choose an answer. Your choice is recorded at once.</p>';
  else if (d.state === 'shown') foot = `<p class="note">${d.correct ? (d.picked === d.correct ? 'Your answer was correct.' : d.picked ? 'Your answer was not the correct one.' : 'You did not answer this exercise.') : 'This question has no right answer.'}</p>`;
  else foot = '<p class="note">The exercise is closed. Your teacher will show the results.</p>';
  return `<div class="card hl"><p class="ch">${esc(d.label.toLowerCase())} · choose one ${timer}</p>
   <p class="mono small" style="margin:0 0 8px">module ${pad(d.moduleNo)} · ${esc(d.moduleTitle)}</p><h2 class="h2" style="font-size:24px;margin-bottom:16px">${esc(d.question)}</h2>${opts}${foot}
   <p class="note">Your answer counts towards engagement. The class sees the results when the teacher shows them.</p></div>`;
}

export function pulseMarkup(d) {
  if (d.mine) return `<div class="card hl"><p class="ch">rate lesson ${d.lessonNo} <span class="r">@analyst</span></p><p class="status" style="font-size:16px"><span style="color:var(--accent)">${I.check}</span>Thank you. Your rating of ${d.mine.rating} is recorded.</p><p class="note">The rating is anonymous. The teacher sees only totals from 5 or more students, and ratings never affect grades.</p></div>`;
  const id = d.idPrefix || 'p';
  const radios = [1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="rating" value="${n}" required${d.sample && d.sample.r === n ? ' checked' : ''}><span>${n}</span></label>`).join('');
  const tog = (name, list, chosen) => list.map(h => `<label class="tog"><input type="checkbox" name="${name}" value="${esc(h)}"${chosen && chosen.includes(h) ? ' checked' : ''}><span>${esc(h)}</span></label>`).join('');
  return `<form method="post" action="/class/rate" class="card"><input type="hidden" name="lesson" value="${d.lessonId || ''}"><p class="ch">rate lesson ${d.lessonNo} · anonymous <span class="r">@analyst</span></p><h3 class="h3">How was lesson ${d.lessonNo}, ${esc(d.moduleTitle)}?</h3>
   <div class="scale" role="radiogroup" aria-label="Rating from 1 to 5" style="margin-top:12px">${radios}</div><div class="scale-lbl"><span>poor</span><span>excellent</span></div>
   <p class="mono small" style="margin:18px 0 8px">what helped you most</p><div class="row">${tog('helped', HELPED, d.sample && d.sample.helped)}</div>
   <p class="mono small" style="margin:16px 0 8px">what got in the way</p><div class="row">${tog('blocked', BLOCKED, d.sample && d.sample.blocked)}</div>
   <label class="f" for="${id}c" style="margin-top:18px">comment (optional)</label><textarea class="inp" id="${id}c" name="comment" rows="2" maxlength="1000" placeholder="One sentence is enough."></textarea>
   <div class="row" style="margin-top:14px"><button type="submit" class="btn pri">Send rating</button><span class="small">Anonymous. Never affects grades.</span></div></form>`;
}

function surveyMarkup(s) {
  const scale = (name, n = 5, from = 1) => `<div class="scale${n === 11 ? ' s11' : ''}" role="radiogroup">${Array.from({ length: n }, (_, i) => i + from).map(v => `<label><input type="radio" name="${name}" value="${v}" required><span>${v}</span></label>`).join('')}</div>`;
  return `<form method="post" action="/survey" class="card hl"><input type="hidden" name="survey" value="${s.id}"><p class="ch">${esc(s.label)} · anonymous <span class="r">@analyst</span></p>
   <h3 class="h3">How is the course going for you?</h3><p class="small" style="margin:0 0 12px">Rate each line from 1 (poor) to 5 (excellent). Your answers are anonymous and never affect grades.</p>
   <div class="survey-row"><span class="fg2" style="font-weight:700">The course overall</span>${scale('overall')}</div>
   ${M.DIMENSIONS.map(([k, l]) => `<div class="survey-row"><span class="fg2">${l}</span>${scale(k)}</div>`).join('')}
   <p class="fg2" style="margin:16px 0 8px;font-weight:700">How likely are you to recommend this course to a friend or colleague? (0 to 10)</p>${scale('recommend', 11, 0)}
   <div class="row" style="margin-top:16px"><button type="submit" class="btn pri">Send survey</button></div></form>`;
}

export function tutorMarkup(d) {
  const sample = d.sample ? `<div class="bubble-me">Does my repository have to be public?</div><div class="bubble-ag"><p class="agent" style="margin:0 0 6px">@tutor</p><div class="b">Yes. Only code in a public GitHub repository is graded, and until the code is public the grade is a fail. You may open a separate GitHub account for the course. <span class="chip" style="margin-top:8px">source: Projects</span></div></div>` : '';
  const off = !d.sample && !aiAvailable() ? '<p class="note" style="margin:0">The tutor is not connected yet. Questions about the rules can go to your teacher through Contact SAW.</p>' : '';
  return `<div class="card" style="display:flex;flex-direction:column;gap:14px"><p class="ch" style="margin:0">ask the tutor <span class="r" data-tutor-left>questions left today: ${d.left} of 20</span></p>
   <div style="display:flex;flex-direction:column;gap:14px" data-tutor-log>${sample}</div>${off}
   <form data-tutor style="display:flex;gap:8px;align-items:flex-end"><label class="sr" for="${d.id}">Your question</label><input class="inp" id="${d.id}" name="question" maxlength="1500" placeholder="Ask about the rules, the lessons or the site"${!d.sample && !aiAvailable() ? ' disabled' : ''}><button class="btn pri" type="submit"${!d.sample && !aiAvailable() ? ' disabled' : ''}>Ask</button></form>
   <p class="small" style="font-size:13px;margin:0">Do not write personal matters here. Questions go to the AI service without your name or email address.</p></div>`;
}

export function checkLogMarkup(c) {
  const lbl = { ok: 'passed', warn: 'warning', bad: 'failed', skip: 'not checked' };
  const results = typeof c.results === 'string' ? JSON.parse(c.results) : c.results;
  return `<div class="card" style="padding:0;overflow:hidden"><div class="row" style="justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line)"><span class="mono small">check.log · ${c.at ? esc(fmtDate(c.at)) : '[date, time]'} · @reviewer</span><span class="row" style="gap:8px">${stat('ok', `${c.passed} passed`)}${c.warnings ? stat('warn', `${c.warnings} warning${c.warnings > 1 ? 's' : ''}`) : ''}${c.failed ? stat('bad', `${c.failed} failed`) : ''}</span></div>
   ${results.map(r => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line2)"><span style="flex:0 0 auto">${stat(r.state, lbl[r.state])}</span><div style="min-width:0"><p style="margin:0;font-weight:700">${esc(r.title)}</p>${r.detail ? `<p class="small" style="margin:2px 0 0">${esc(r.detail)}</p>` : ''}</div></div>`).join('')}</div>`;
}

export function readyMarkup(conds) {
  const met = conds.filter(c => c.state === 'ok').length;
  return `<div class="card hl"><p class="ch">readiness <span class="r">checked by @examiner</span></p>
   <p style="margin:0;font-size:44px;font-weight:800;letter-spacing:-.02em;line-height:1">${met} <span style="font-size:20px;color:var(--muted);font-weight:600">of ${conds.length} conditions met</span></p>
   <div style="display:grid;grid-template-columns:repeat(${conds.length},minmax(0,1fr));gap:4px;margin:16px 0 8px" aria-hidden="true">${conds.map(c => `<span style="height:8px;border-radius:2px;background:${c.state === 'ok' ? 'var(--accent)' : 'var(--line)'}"></span>`).join('')}</div>
   ${conds.map(c => `<div class="li"><div class="t"><b style="font-size:15px">${esc(c.title)}</b><span>${esc(c.text)}</span></div>${stat(c.state, { ok: 'met', warn: 'needs work', bad: 'not met', none: 'not yet' }[c.state])}</div>`).join('')}
   <p class="note">These conditions are a draft. The teacher sets the final conditions.</p></div>`;
}

function examMarkup() {
  const v = k => esc(setting(`exam_${k}`, '') || `[${k === 'date' ? 'date and time' : k === 'length' ? 'duration' : k === 'where' ? 'in class or online' : '%'}]`);
  return `<div class="card"><p class="ch">the exam <span class="r">draft format</span></p><dl class="kv" style="margin:0"><dt>date</dt><dd>${v('date')}</dd><dt>length</dt><dd>${v('length')}</dd><dt>part A</dt><dd>Closed questions on all modules, marked by @examiner and reviewed by the teacher. Weight: ${v('weightA')}.</dd><dt>part B</dt><dd>You direct an agent on a small task and submit the session record. The teacher grades it. Weight: ${v('weightB')}.</dd><dt>where</dt><dd>${v('where')}</dd></dl></div>`;
}

function tilesMarkup(t, exam = true) {
  return tiles([
    ['live exercises answered', t.answered, t.answeredSub],
    ['live exercise score', t.score, t.scoreSub],
    ['practice accuracy', t.practice, t.practiceSub],
    ['modules studied', t.modules, t.modulesSub],
    ['projects passing', t.projects, t.projectsSub],
    ...(exam ? [['exam readiness', t.ready, 'conditions met']] : []),
  ]);
}

function scoreChart(scores, groupAvg, labels) {
  return chart({ type: 'line', labels, min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: 'pct', aria: 'Live exercise score by lesson compared with the group average.', series: [{ name: 'You', values: scores, color: '#3DDC97' }, { name: 'Group average', values: groupAvg, color: '#8B949E', dash: true }] });
}

// ---------- shared data for a signed-in student ----------
function studentData(ctx) {
  const u = ctx.user, g = ctx.group, prog = programme(g.programme);
  const matrix = M.groupMatrix(g.id);
  const live = M.personLive(matrix, u.id);
  const avgs = M.groupLessonAverages(matrix);
  const prac = M.practiceOf(u.id, g.programme);
  const projs = M.projectsOf(u.id);
  const ready = M.readiness(u, { live, prac, projects: projs });
  return { u, g, prog, matrix, live, avgs, prac, projs, ready };
}

function groupInfo(ctx) {
  const g = ctx.group;
  return { inst: g.institution, instS: M.instShort(g.institution), group: g.code, who: ctx.user.email };
}

// ---------- My program ----------
function programmeBody(prog, info, lessons, interactive, ctx) {
  const byModule = new Map();
  // A lesson whose date has passed counts as taught, even if the teacher did
  // not run it on the site (decision of 1 November 2026).
  const phase = l => lessonPhase(l);
  for (const l of lessons) for (const n of lessonModules(l)) if (!byModule.has(n) || phase(l) !== 'held') byModule.set(n, l);
  const next = lessons.find(l => phase(l) === 'live') || lessons.find(l => phase(l) !== 'held');
  const parts = prog.parts.map(p => {
    let rows = '';
    for (let n = p.from; n <= p.to; n++) {
      const m = prog.modules.find(x => x.n === n);
      const l = byModule.get(n);
      const st = !l ? '' : phase(l) === 'held' ? stat('ok', 'taught') : phase(l) === 'live' ? '<span class="chip solid">live now</span>' : `<span class="chip">lesson ${l.number} · ${esc(l.starts_at ? dayLabel(l.starts_at) : fmtDate(l.starts_at))}</span>`;
      const has = moduleContent(prog.id, n);
      const title = interactive && has ? `<a href="/study/${n}" style="color:var(--fg);text-decoration:none">${esc(m.title)}</a>` : esc(m.title);
      rows += `<div class="li"><span class="n">${pad(n)}</span><div class="t"><b>${title}</b><span>${esc(m.summary)}</span></div>${st}</div>`;
    }
    return `<div class="section"><div class="row" style="gap:6px 14px;margin-bottom:6px"><span class="mono" style="color:var(--accent);font-size:14px">part-${p.n}/</span><h3 class="h3" style="margin:0;font-size:21px">${esc(p.title)}</h3><span class="mono small">modules ${pad(p.from)}–${pad(p.to)}</span></div><p class="fg2" style="margin:0 0 12px;font-size:15px">${esc(p.text)}</p><div class="card" style="padding:4px 20px">${rows}</div></div>`;
  }).join('');
  const nextCard = next
    ? `<div class="card hl" style="--b:420px;flex:999 1 420px"><p class="ch">${phase(next) === 'live' ? 'lesson running now' : phase(next) === 'today' ? 'today\'s lesson' : 'next lesson'} <span class="r">${esc(fmtDate(next.starts_at))}</span></p><h2 class="h2" style="font-size:24px">Lesson ${next.number} · ${esc(lessonTitle(prog.id, next))}</h2><p class="fg2" style="margin:0 0 16px">The warm-up quiz opens before the lecture starts. Keep Learn in class open beside Zoom during the lesson.</p><div class="row"><a class="btn pri" href="/class">Open Learn in class</a>${next.zoom_url ? `<a class="btn sec" href="${esc(next.zoom_url)}" rel="noopener">Zoom link</a>` : ''}</div></div>`
    : '<div class="card" style="--b:420px;flex:999 1 420px"><p class="ch">next lesson</p><p class="fg2" style="margin:0">Your teacher has not set the next lesson yet.</p></div>';
  // A weight set by the teacher wins; otherwise the weight from the syllabus.
  const weight = k => esc(setting(`weight_${k}`, '') || (prog.grade.find(x => x.key === k) || {}).weight || '[%]');
  const ticks = arr => `<div class="ticks" style="margin:0">${arr.map(t => `<p>${I.check}<span>${esc(t)}</span></p>`).join('')}</div>`;
  const extra = [
    prog.outcomes ? `<div class="section card"><p class="ch">what you will be able to do</p>${ticks(prog.outcomes)}${prog.prerequisites ? `<p class="note">${esc(prog.prerequisites)}</p>` : ''}</div>` : '',
  ].join('');
  const after = [
    prog.gradeNotes ? `<div class="section card"><p class="ch">how your work is graded</p>${prog.gradeNotes.map(t => `<p class="fg2" style="margin:0 0 10px;font-size:15px">${esc(t)}</p>`).join('')}</div>` : '',
    prog.projects && prog.projects.some(x => x.text) ? `<h2 class="h2 section">Projects</h2><div class="cols" style="--b:320px;align-items:stretch">${prog.projects.map(x => `<div class="card"><p class="ch">${esc(x.title.toLowerCase())}</p><p class="fg2" style="margin:0;font-size:15px">${esc(x.text || '')}</p></div>`).join('')}</div><div class="section card"><p class="ch">project rules</p>${ticks(prog.projectRules)}</div>` : '',
    prog.policies ? `<h2 class="h2 section">Course policies</h2><div class="cols" style="--b:300px;align-items:stretch">${prog.policies.map(x => `<div class="card"><p class="ch">${esc(x.title.toLowerCase())}</p><p class="fg2" style="margin:0;font-size:15px">${esc(x.text)}</p></div>`).join('')}</div>` : '',
    prog.reading ? `<div class="section card"><p class="ch">textbook and reading</p><p class="fg2" style="margin:0 0 12px">${esc(prog.reading.textbook)}</p><ul class="fg2" style="margin:0 0 10px;padding-left:20px;font-size:14.5px">${prog.reading.list.map(r => `<li style="margin-bottom:6px">${esc(r)}</li>`).join('')}</ul><p class="small" style="margin:0">${esc(prog.reading.note || '')}</p></div>` : '',
  ].join('');
  const docs = prog.documents.map(d => d.url ? `<a href="${esc(d.url)}" rel="noopener" style="display:flex;justify-content:space-between;min-height:44px;align-items:center;color:var(--fg);text-decoration:none;border-bottom:1px solid var(--line2)"><span>${esc(d.title)}</span><span class="chip">open</span></a>` : `<div style="display:flex;justify-content:space-between;min-height:44px;align-items:center;border-bottom:1px solid var(--line2)"><span class="fg2">${esc(d.title)}</span><span class="chip none">not published yet</span></div>`).join('');
  return `<div class="cols" style="align-items:stretch">${nextCard}
   <div class="card" style="flex:1 1 300px"><p class="ch">your group</p><dl class="kv" style="margin:0"><dt>institution</dt><dd>${esc(info.inst)}</dd><dt>group</dt><dd>${esc(info.group)}</dd><dt>teacher</dt><dd>Mikael Gorsky</dd><dt>signed in as</dt><dd class="mono" style="font-size:13.5px">${esc(info.who)}</dd></dl><p class="note">The site placed you in this group from the list your teacher keeps.</p></div></div>
   <div class="section"><h2 class="h2">About the program</h2>${prog.description.map(p => `<p class="lede" style="margin-bottom:12px">${esc(p)}</p>`).join('')}</div>${extra}
   <div class="cols section" style="--b:260px;gap:14px">${prog.grade.map(a => `<div class="card" style="padding:16px 18px"><p class="ch" style="margin-bottom:6px">${esc(a.title)} <span class="r">${weight(a.key)} of the grade</span></p><p style="margin:0;font-size:15px" class="fg2">${esc(a.text)}</p></div>`).join('')}</div>
   ${interactive ? scheduleCard(prog, lessons, phase) : ''}
   <h2 class="h2 section">Curriculum</h2>${parts}${after}
   <div class="cols section"><div class="card" style="--b:320px"><p class="ch">documents</p>${docs}</div>
   <div class="card" style="--b:320px"><p class="ch">teacher</p><p style="margin:0 0 6px;font-weight:800;font-size:18px">Mikael Gorsky</p><p class="fg2" style="margin:0 0 14px;font-size:15px">Questions about the program go to your teacher through Contact SAW. Questions about the rules can also go to ${agS('tutor')}.</p><a class="btn sec" href="/contact">Contact SAW</a></div></div>`;
}

// The meetings of the student's own group, from the semester schedule.
const PHASE_CHIP = { held: () => stat('ok', 'held'), live: () => '<span class="chip solid">live now</span>', today: () => '<span class="chip solid">today</span>', coming: () => '<span class="chip">coming</span>' };
function scheduleCard(prog, lessons, phase) {
  if (!lessons.length) return '<div class="section card"><p class="ch">your schedule</p><p class="fg2" style="margin:0">Your teacher has not put the schedule of your group on the site yet.</p></div>';
  const rows = lessons.map(l => {
    const ms = lessonModules(l);
    return `<tr><td class="m">${l.number}</td><td class="m">${l.starts_at ? esc(dayLabel(l.starts_at)) : '[date]'}</td><td class="m">${l.starts_at ? `${esc(timeLabel(l.starts_at))}${l.ends_at ? `–${esc(timeLabel(l.ends_at))}` : ''}` : ''}</td><td>${ms.length ? `<span class="mono small" style="display:block">module${ms.length > 1 ? 's' : ''} ${ms.join(' and ')}</span>` : ''}${esc(lessonTitle(prog.id, l))}</td><td>${PHASE_CHIP[phase(l)]()}</td></tr>`;
  }).join('');
  return `<div class="section"><h2 class="h2">Your schedule</h2><p class="fg2" style="margin:0 0 12px;font-size:15px">The meetings of your group this semester, in Israel time. The Teaching Assistant knows this schedule and today's date, so you can ask it what today's class covers and what to read for it.</p><div class="card" style="padding:6px 0"><div class="scroll"><table class="tbl" style="min-width:620px"><thead><tr><th>lesson</th><th>date</th><th>time</th><th>content</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
}

export function programmePage(ctx) {
  const prog = programme('ase');
  if (!signedIn(ctx)) {
    const sampleLessons = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, module: i + 1, state: 'ended' })).concat([{ number: 9, module: 9, state: 'planned', starts_at: null }]);
    const ex = `<div class="card" style="margin-bottom:16px"><p class="mono small" style="margin:0 0 6px">Holon Institute of Technology · group 62121-31</p><h2 class="h1" style="font-size:32px;margin:0">${esc(prog.title)}</h2></div>` + programmeBody(prog, { inst: 'Holon Institute of Technology', group: '62121-31', who: 'student@gmail.com' }, sampleLessons, false).split('<h2 class="h2 section">Curriculum</h2>')[0];
    return `<div class="wrap page">${head('cat program', 'My program', 'This page gives you the overview of the program you are enrolled in: its curriculum, your lesson calendar, the parts of your grade, the rules and the documents.')}
     ${steps([['Register once', 'Register with the email address you gave your course organizer.'], ['The site finds your group', 'The site reads your institution and group from the list your teacher keeps.'], ['Your program opens', 'This page shows your program, and the 4 sections show your lessons, modules, projects and exam.']])}
     <div class="section">${exFrame('the overview of a program', ex)}</div>
     ${signStrip('Sign in to see your program.', ['the curriculum, part by part and module by module', 'your lesson calendar and the Zoom link', `the parts of your grade and the rules for projects${hasExam('ase') ? ' and the exam' : ''}`, 'the program documents'])}</div>`;
  }
  const g = ctx.group, p = programme(g.programme);
  return `<div class="wrap page">${head('cat program', esc(p.title), `${esc(g.institution)} · group ${esc(g.code)} · teacher Mikael Gorsky`, `<span class="chip">${p.modules.length} modules · ${p.parts.length} parts</span>`)}
   ${programmeBody(p, groupInfo(ctx), M.lessonsOf(g.id), true, ctx)}</div>`;
}

// ---------- Learn in class ----------
// In a lesson of 2 modules each item's label starts with its module, for example
// "Module 4 · After block 1" (decision of 31 October 2026).
const itemModule = (item, lesson) => { const m = /^Module (\d+) · /.exec(item.label); return m ? Number(m[1]) : lesson.module; };
const itemLabel = item => item.label.replace(/^Module \d+ · /, '');
export function livePartial(ctx) {
  const g = ctx.group;
  const lesson = M.liveLesson(g.id);
  if (!lesson) return { key: 'none', html: '<div class="card"><p class="ch">no lesson running</p><p class="fg2" style="margin:0">No lesson is running now. When your teacher starts a lesson, the exercises appear here.</p></div>' };
  M.tick(lesson);
  const items = M.itemsOf(lesson.id);
  const item = items.find(i => i.state === 'open') || [...items].filter(i => i.state === 'shown' || i.state === 'closed').sort((a, b) => (b.opened_at || '').localeCompare(a.opened_at || ''))[0];
  if (!item) return { key: `wait-${lesson.id}`, html: `<div class="card hl"><p class="ch">lesson ${lesson.number} is running</p><p class="fg2" style="margin:0">The first exercise opens when your teacher releases it. Keep this page open.</p></div>` };
  const mine = ctx.db.get('SELECT choice FROM answers WHERE item_id = ? AND user_id = ?', item.id, ctx.user.id);
  const counts = item.state === 'shown' ? M.answerCounts(item.id) : null;
  const html = liveCardMarkup({ interactive: true, itemId: item.id, label: itemLabel(item), moduleNo: itemModule(item, lesson), moduleTitle: moduleTitle(g.programme, itemModule(item, lesson)), question: item.question, options: JSON.parse(item.options), picked: mine && mine.choice, state: item.state, closesAt: item.closes_at, correct: item.correct, counts });
  return { key: `${item.id}-${item.state}-${mine ? mine.choice : ''}`, html };
}

export function classPage(ctx) {
  if (!signedIn(ctx)) {
    const sample = liveCardMarkup({ label: 'Exercise after block 2', moduleNo: 9, moduleTitle: moduleTitle('ase', 9), question: 'What does module 9 ask you to make visible for every model call?', options: [['a', 'Its price and its time.'], ['b', 'The source code of the model.'], ['c', 'The name of the person who wrote the prompt.'], ['d', 'The number of agents in the session.']], picked: 'a', state: 'open', timerText: '01:42' });
    return `<div class="wrap page">${head('learn --in-class', 'Learn in class', 'Your lessons run in class or on Zoom. Keep this page open beside the lecture. Before the lecture starts you answer a warm-up quiz, and after each 15-minute block you answer a short exercise.', ag('proctor'))}
     ${steps([['Before the lecture', '@proctor opens a warm-up quiz on the last lesson.'], ['After each block', '@proctor opens a short exercise with a timer. You answer on your phone or laptop.'], ['Class results', 'Your teacher shows the answers of the class and discusses them.'], ['After the lesson', 'You rate the lesson in about 20 seconds. Your rating is anonymous.']])}
     <div class="cols section" style="align-items:flex-start"><div style="--b:420px;flex:999 1 420px">${exFrame('an exercise during a lesson', sample)}</div><div style="--b:340px">${exFrame('the lesson rating', pulseMarkup({ lessonNo: 8, moduleTitle: moduleTitle('ase', 8), sample: { r: 4, helped: ['Live exercises'], blocked: ['Too fast'] }, idPrefix: 'ex' }))}</div></div>
     ${signStrip('Sign in to see your lesson calendar, answer the exercises and see your scores.', ['your lesson calendar and the Zoom link', 'the live exercise as soon as it opens', 'your answers and scores for each lesson, set against your group', 'the rating form for each lesson'])}</div>`;
  }
  const d = studentData(ctx);
  const lesson = M.liveLesson(d.g.id);
  const partial = livePartial(ctx);
  const next = lesson || M.nextLesson(d.g.id);
  let plan = '';
  if (lesson) {
    const items = M.itemsOf(lesson.id);
    const mineIds = new Set(ctx.db.all('SELECT item_id FROM answers WHERE user_id = ? AND item_id IN (SELECT id FROM items WHERE lesson_id = ?)', ctx.user.id, lesson.id).map(r => r.item_id));
    plan = `<div class="card"><p class="ch">lesson ${lesson.number} <span class="r">${esc(fmtDate(lesson.starts_at))}</span></p>${items.map(x => {
      const st = x.state === 'open' ? '<span class="chip solid">open now</span>' : mineIds.has(x.id) ? stat('ok', 'answered') : x.state === 'ready' ? '<span class="chip none">not yet</span>' : stat('none', 'not answered');
      return `<div class="li"><span class="t"><b style="font-size:15px;font-weight:600">${esc(x.label)}</b></span>${st}</div>`;
    }).join('')}${lesson.zoom_url ? `<a class="btn sec wide" href="${esc(lesson.zoom_url)}" rel="noopener" style="margin-top:12px">Zoom link</a>` : ''}</div>`;
  } else if (next) {
    plan = `<div class="card"><p class="ch">next lesson <span class="r">${esc(fmtDate(next.starts_at))}</span></p><p style="margin:0 0 10px;font-weight:700">Lesson ${next.number} · ${esc(lessonTitle(d.g.programme, next))}</p>${next.zoom_url ? `<a class="btn sec wide" href="${esc(next.zoom_url)}" rel="noopener">Zoom link</a>` : ''}</div>`;
  }
  const studyMod = next ? next.module : null;
  const rate = M.lessonToRate(ctx.user);
  const survey = M.openSurvey(d.g.id);
  const surveyCard = survey && !M.mySurveyAnswer(ctx.user, survey.id) ? `<div class="section">${surveyMarkup(survey)}</div>` : '';
  const rows = d.matrix.lessons.map((l, i) => {
    const c = d.live.cells[i];
    const mine = l.state === 'ended' ? M.myLessonRating(ctx.user.id, l.id) : null;
    return `<tr><td class="m">${l.number}</td><td>${esc(lessonTitle(d.g.programme, l))}</td><td>${squares(c.answered, l.opened)}</td><td class="m">${d.live.scores[i] == null ? '–' : d.live.scores[i] + '%'}</td><td class="m">${d.avgs[i].score == null ? '–' : d.avgs[i].score + '%'}</td><td class="m">${mine ? mine.rating + ' / 5' : l.state === 'ended' ? 'not rated' : '–'}</td></tr>`;
  }).join('');
  return `<div class="wrap page">${head('learn --in-class', 'Learn in class', lesson ? `Lesson ${lesson.number} is running now. Keep this page open beside Zoom and answer each exercise when it opens.` : 'When a lesson runs, its exercises appear on this page. Keep it open beside the lecture.', (lesson ? '<span class="chip solid">live</span>' : '') + ag('proctor'))}
   <div class="cols" style="align-items:flex-start"><div style="--b:520px;flex:999 1 520px"><div data-live="/class/live" data-key="${esc(partial.key)}">${partial.html}</div></div>
   <div class="stack" style="flex:1 1 300px">${plan}${studyMod && moduleContent(d.g.programme, studyMod) ? `<div class="card flat"><p class="ch">study this module</p><p style="margin:0 0 12px;font-weight:700">${esc(moduleTitle(d.g.programme, studyMod))}</p><a class="btn out" href="/study/${studyMod}">open the study page</a></div>` : ''}</div></div>
   ${surveyCard}
   ${rate ? `<div class="section">${pulseMarkup({ lessonId: rate.lesson.id, lessonNo: rate.lesson.number, moduleTitle: lessonTitle(d.g.programme, rate.lesson), mine: rate.mine })}</div>` : ''}
   ${d.matrix.lessons.length ? `<div class="section"><div class="sechead"><h2 class="h2">Your lessons</h2></div><div class="card" style="padding:6px 0"><div class="scroll"><table class="tbl"><thead><tr><th>lesson</th><th>module</th><th>answered</th><th>your score</th><th>group average</th><th>your rating</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>` : ''}
   </div>`;
}

// ---------- Study alone ----------
export function studyPage(ctx) {
  if (!signedIn(ctx)) {
    const studyEx = `<div class="card"><p class="mono small" style="margin:0 0 6px">module 01</p><h2 class="h2" style="font-size:23px">${esc(moduleTitle('ase', 1))}</h2><div class="cols" style="--b:220px;gap:12px;margin:14px 0">
      <div class="card flat" style="padding:14px"><p class="ch" style="margin-bottom:4px">idea-1</p><p style="margin:0;font-weight:800">A discipline, not a tool</p></div><div class="card flat" style="padding:14px"><p class="ch" style="margin-bottom:4px">idea-4</p><p style="margin:0;font-weight:800">The central tension</p></div></div>
      <p class="mono small" style="margin:0 0 8px">practice · exercise 1 of 3</p><p style="margin:0 0 10px;font-weight:700">Which tension does this course set out to answer?</p>
      <button type="button" class="opt" aria-pressed="true"><span class="k">[A]</span><span>The speed of production has outrun our ability to trust the result.</span></button><button type="button" class="opt" aria-pressed="false"><span class="k">[B]</span><span>Models are still too expensive for everyday coding.</span></button>
      <p class="status" style="margin-top:6px"><span style="color:var(--accent)">${I.check}</span>Correct. Module 1 names this tension.</p></div>`;
    return `<div class="wrap page">${head('study --alone', 'Study alone', `Each module of your program has a study page with key ideas, slides, the recording of the lesson and practice exercises. ${agS('tutor')} answers your questions about the course rules, the lessons and the site.`, ag('tutor'))}
     ${steps([['Read the key ideas', 'Each study page opens with the 4 or 5 ideas of the module.'], ['Watch or review', 'The slides and the recording of the lesson are on the same page.'], ['Practice', 'Practice exercises show at once whether you were right. They count towards no grade.'], ['Ask', '@tutor answers questions about the rules, the lessons and the site, up to 20 a day.']])}
     <div class="cols section" style="align-items:flex-start"><div style="--b:420px;flex:999 1 420px">${exFrame('a study page', studyEx)}</div><div style="--b:340px">${exFrame('a question to the tutor', tutorMarkup({ sample: true, left: 18, id: 'askEx' }))}</div></div>
     ${signStrip('Sign in to study the modules of your program.', ['the study page of each module taught so far', 'practice exercises, with your own results kept', 'questions to @tutor', 'suggestions on what to review before the next lesson'])}</div>`;
  }
  const d = studentData(ctx);
  const used = ctx.db.get('SELECT count FROM tutor_usage WHERE user_id = ? AND day = ?', ctx.user.id, new Date().toISOString().slice(0, 10));
  const left = 20 - (used ? used.count : 0);
  const withContent = Object.keys(d.prac).map(Number);
  const studied = withContent.filter(n => d.prac[n].studied);
  const next = M.liveLesson(d.g.id) || M.nextLesson(d.g.id);
  const contMod = withContent.find(n => !d.prac[n].studied) || (next ? next.module : null);
  const weak = withContent.filter(n => d.prac[n].accuracy != null && d.prac[n].accuracy < 70).sort((a, b) => d.prac[a].accuracy - d.prac[b].accuracy)[0];
  const list = d.prog.modules.map(m => {
    const p = d.prac[m.n];
    const st = !p ? '<span class="chip none">study page not ready</span>' : p.studied ? stat('ok', `practice ${p.accuracy == null ? 'done' : p.accuracy + '%'}`) : p.done ? '<span class="chip solid">in progress</span>' : '<span class="chip">not started</span>';
    return `<div class="li"><span class="n">${pad(m.n)}</span><div class="t"><b>${p ? `<a href="/study/${m.n}" style="color:var(--fg);text-decoration:none">${esc(m.title)}</a>` : esc(m.title)}</b><span>${esc(m.summary)}</span></div>${st}</div>`;
  }).join('');
  const cont = contMod && d.prac[contMod]
    ? `<div class="card hl"><p class="ch">continue <span class="r">module ${pad(contMod)}</span></p><h2 class="h2" style="font-size:24px">${esc(moduleTitle(d.g.programme, contMod))}</h2><p class="small" style="margin:0 0 16px">Practice: ${d.prac[contMod].done} of ${d.prac[contMod].total} exercises done.</p><a class="btn pri" href="/study/${contMod}">Continue studying</a></div>`
    : '<div class="card"><p class="ch">continue</p><p class="fg2" style="margin:0">You have studied every module that has a study page so far. New pages appear as the course goes on.</p></div>';
  const sugg = weak ? `<div class="card flat"><p class="ch">suggestion from @tutor</p><p class="fg2" style="margin:0">Your practice score on module ${weak} was ${d.prac[weak].accuracy}%. Read its key ideas again, then try its exercises again.</p></div>` : '';
  // Questions the tutor passed on carry no asker, so the teacher's answers are
  // published to every student of the program.
  const answered = ctx.db.all('SELECT question, answer FROM tutor_passed WHERE programme = ? AND answer IS NOT NULL ORDER BY at DESC LIMIT 6', d.g.programme);
  const fromTeacher = answered.length ? `<div class="card flat"><p class="ch">answers from your teacher</p>${answered.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--line2)"><p style="margin:0 0 4px;font-weight:700;font-size:15px">${esc(a.question)}</p><p class="fg2" style="margin:0;font-size:15px">${esc(a.answer)}</p></div>`).join('')}</div>` : '';
  return `<div class="wrap page">${head('study --alone', 'Study alone', `Work through each module at your own pace. ${agS('tutor')} answers questions about the course rules, the lessons and the site.`)}
   <div class="cols" style="align-items:flex-start"><div class="stack" style="--b:420px;flex:999 1 420px">${cont}${sugg}${fromTeacher}</div><div style="flex:1 1 340px">${tutorMarkup({ left, id: 'ask' })}</div></div>
   <div class="section"><div class="sechead"><h2 class="h2">Modules</h2><p class="small mono">${studied.length} studied · ${withContent.length} with study pages · ${d.prog.modules.length} in all</p></div><div class="card" style="padding:4px 20px">${list}</div></div></div>`;
}

export function modulePage(ctx, n) {
  const g = ctx.group, progId = g.programme;
  const mc = moduleContent(progId, n);
  const title = moduleTitle(progId, n);
  if (!mc) return `<div class="wrap page"><p class="eyebrow"><a href="/study" style="color:var(--muted)">study</a> / module ${pad(n)}</p><h1 class="h1">${esc(title)}</h1><div class="card dash" style="max-width:680px"><p class="fg2" style="margin:0">The study page for this module is not ready yet. It appears here before the lesson on this module.</p></div></div>`;
  const prac = M.practiceOf(ctx.user.id, progId)[n];
  const exHtml = mc.practice.map((e, i) => {
    const mine = prac.answers[e.id];
    if (e.kind === 'choice') {
      const checked = Boolean(mine);
      const opts = e.options.map(([k, t]) => {
        const on = mine && mine.answer === k;
        const cls = checked && on ? (k === e.correct ? ' right' : ' wrong') : '';
        return `<button type="submit" name="answer" value="${esc(k)}" class="opt${cls}" aria-pressed="${on}"><span class="k">[${esc(k.toUpperCase())}]</span><span>${esc(t)}</span></button>`;
      }).join('');
      const res = !checked ? '' : mine.correct ? `<p class="status" role="status" style="margin:6px 0 0"><span style="color:var(--accent)">${I.check}</span>${esc(e.right)}</p>` : `<p class="status" role="status" style="margin:6px 0 0"><span style="color:var(--bad)">${I.x}</span>${esc(e.wrong)}</p>`;
      return `<form method="post" action="/study/${n}/practice#${e.id}" class="card" id="${e.id}"><input type="hidden" name="exercise" value="${esc(e.id)}"><p class="mono small" style="margin:0 0 8px">exercise ${i + 1} of ${mc.practice.length} · choose one</p><h3 class="h3" style="font-size:19px;margin-bottom:14px">${esc(e.question)}</h3>${opts}${res}</form>`;
    }
    return `<form method="post" action="/study/${n}/practice#${e.id}" class="card" id="${e.id}"><input type="hidden" name="exercise" value="${esc(e.id)}"><p class="mono small" style="margin:0 0 8px">exercise ${i + 1} of ${mc.practice.length} · short answer</p><h3 class="h3" style="font-size:19px"><label for="a-${e.id}">${esc(e.question)}</label></h3><p class="small" style="margin:0 0 12px">${esc(e.help || '')}</p><textarea class="inp" id="a-${e.id}" name="answer" rows="3" maxlength="4000" placeholder="Your answer" required>${mine ? esc(mine.answer) : ''}</textarea>
     ${mine ? `<div class="card flat" style="margin-top:12px"><p class="ch">teacher’s answer</p><p class="fg2" style="margin:0">${esc(e.model)}</p></div><button type="submit" class="btn out" style="margin-top:12px">save my answer again</button>` : '<button type="submit" class="btn out" style="margin-top:12px">save and show the teacher’s answer</button>'}</form>`;
  }).join('');
  const myRating = M.myModuleRating(ctx.user, n);
  const media = (url, label) => url ? `<a class="ph" href="${esc(url)}" rel="noopener" style="text-decoration:none">${label === 'recording' ? I.play : ''} open the ${label}</a>` : `<div class="ph" role="img" aria-label="${label} not published yet">${label === 'recording' ? I.play : ''}[${label} not published yet]</div>`;
  return `<div class="wrap page"><p class="eyebrow"><a href="/study" style="color:var(--muted)">study</a> / module ${pad(n)}</p>
   <div class="chips" style="margin-bottom:14px">${prac.studied ? stat('ok', 'studied') : ''}${ag('tutor')}</div>
   <h1 class="h1">${esc(title)}</h1><p class="lede" style="margin-bottom:${mc.reading ? 12 : 32}px">${esc(mc.intro)}</p>${mc.reading ? `<p class="mono small" style="margin:0 0 32px"><span style="color:var(--accent)">read</span> · textbook, ${esc(mc.reading.replace(/^Chapter/, 'chapter'))}</p>` : ''}
   <h2 class="h2">Key ideas</h2><div class="cols" style="--b:300px;gap:14px">${mc.ideas.map((d, i) => `<div class="card"><p class="ch" style="margin-bottom:6px">idea-${i + 1}</p><h3 class="h3">${esc(d.title)}</h3><p class="fg2" style="margin:0;font-size:15px">${esc(d.text)}</p></div>`).join('')}</div>
   <div class="section"><h2 class="h2">Slides and recording</h2><div class="cols" style="--b:320px;gap:14px"><div>${media(mc.slides, 'slides')}</div><div>${media(mc.recording, 'recording')}</div></div></div>
   <div class="section"><div class="sechead"><h2 class="h2">Practice exercises</h2><p class="small">Practice answers are kept for you only and count towards no grade.</p></div><div class="stack" style="gap:14px">${exHtml}</div></div>
   <form method="post" action="/study/${n}/rate" class="section card"><p class="ch">how clear was this module? <span class="r">anonymous · @analyst</span></p><div class="scale" role="radiogroup" aria-label="Clarity from 1 to 5">${[1, 2, 3, 4, 5].map(v => `<label><input type="radio" name="clarity" value="${v}" required${myRating && myRating.clarity === v ? ' checked' : ''}><span>${v}</span></label>`).join('')}</div><div class="scale-lbl"><span>not clear</span><span>very clear</span></div><div class="row" style="margin-top:12px"><button type="submit" class="btn out">${myRating ? 'change my rating' : 'send rating'}</button></div></form>
   </div>`;
}

// ---------- Submit projects ----------
function rulesMarkup(prog) {
  return `<div class="card"><p class="ch">project rules of your program</p><div class="stack" style="gap:10px;font-size:15px">${prog.projectRules.map(r => `<p class="fg2" style="margin:0">${esc(r)}</p>`).join('')}</div></div>`;
}
const SAMPLE_CHECK = { passed: 5, warnings: 1, failed: 1, results: [
  { state: 'ok', title: 'The repository is public.' }, { state: 'ok', title: 'A context file, CLAUDE.md, is in the root folder.' },
  { state: 'ok', title: 'The work is spread over time.', detail: '23 commits on 14 days over 5 weeks.' },
  { state: 'warn', title: 'Commit messages say what changed.', detail: '6 of 23 messages are a single word, such as "fix" or "update".' },
  { state: 'bad', title: 'Tests exist.', detail: 'No test files or test folder were found.' },
  { state: 'ok', title: 'A record of the work with the agent is kept in the repository.' }, { state: 'ok', title: 'The README explains how to run the project.' }] };

export function projectsPage(ctx) {
  if (!signedIn(ctx)) {
    return `<div class="wrap page">${head('check projects', 'Submit projects', `Your program may ask you to build projects. You link the public repository of each project, ${agS('reviewer')} checks its structure and history and explains every failed check, and your teacher grades the work itself.`, ag('reviewer'))}
     ${steps([['Link the repository', 'Paste the link to the public repository of your project.'], ['@reviewer checks it', 'The check looks at access, the context file, the history of commits, tests and the README.'], ['Fix and check again', 'Every failed check comes with an explanation. You can run the check again at any time.'], ['Your teacher grades', 'The check never grades. Your teacher grades the work itself.']])}
     <div class="cols section" style="align-items:flex-start"><div style="--b:460px;flex:999 1 460px">${exFrame('the result of a check', checkLogMarkup(SAMPLE_CHECK))}</div><div class="card" style="--b:300px"><p class="ch">what @reviewer checks</p>${SAMPLE_CHECK.results.map(c => `<p class="status fg2" style="margin:0 0 10px;align-items:flex-start;font-size:15px"><span style="color:var(--accent);margin-top:2px">${I.check}</span>${esc(c.title)}</p>`).join('')}</div></div>
     ${signStrip('Sign in to submit your repositories and see your checks.', ['the project rules of your program', 'a check of each repository whenever you ask', 'feedback from @reviewer on every failed check', 'the history of your checks'])}</div>`;
  }
  const d = studentData(ctx);
  const kind = ctx.query.kind === 'tribunal' ? 'tribunal' : 'own';
  const pr = d.projs[kind];
  const label = k => { const s = M.projectState(d.projs[k]); return s === 'failed' ? `${d.projs[k].last.failed} failed` : { none: 'not submitted', submitted: 'not checked', passed: 'passed', warning: 'warning' }[s]; };
  const err = ctx.query.e ? `<p class="alert">${esc(ctx.query.e)}</p>` : '';
  const form = `<form method="post" action="/projects/submit" style="margin-bottom:20px"><input type="hidden" name="kind" value="${kind}"><label class="f" for="repo">public repository link</label><div class="row"><input class="inp" id="repo" name="repo" required value="${pr.project ? esc(pr.project.repo) : ''}" placeholder="https://github.com/name/project" style="flex:1 1 300px;width:auto;font-family:var(--mono);font-size:14.5px"><button type="submit" class="btn pri">${pr.project ? 'Run check' : 'Submit and check'}</button></div><p class="small" style="margin-top:6px;font-size:13px">The check takes a few seconds.</p></form>`;
  const body = pr.last
    ? checkLogMarkup(pr.last) + `<div class="card flat" style="margin-top:20px"><p class="ch">feedback from @reviewer</p><p class="fg2" style="margin:0">${esc(pr.last.feedback || '')}</p></div><p class="small" style="margin-top:12px">The check looks at the structure and history of the repository only. Mikael Gorsky grades the work itself.</p>`
    : `<div class="card dash"><p class="ch">no check yet</p><p class="fg2" style="margin:0">Submit the link when the repository is ready. @reviewer runs the checks at once.</p></div>`;
  const hist = pr.history.length ? `<div class="card"><p class="ch">earlier checks</p><div class="log">${pr.history.map(h => `<div class="l"><span class="x">${esc(fmtDate(h.at))}</span><span class="muted">${h.passed} passed · ${h.warnings} warning · ${h.failed} failed</span></div>`).join('')}</div></div>` : '';
  return `<div class="wrap page">${head(`check ${kind === 'own' ? 'individual-project' : 'tribunal'}`, 'Submit projects', `Link the public repository of each project. ${agS('reviewer')} checks its structure and history and explains every failed check. The teacher grades the work itself.`)}
   <div class="tabs" role="tablist" aria-label="Projects"><a role="tab" aria-selected="${kind === 'own'}" href="/projects?kind=own" style="text-decoration:none;display:inline-flex;align-items:center;min-height:46px;padding:0 16px;font-family:var(--mono);font-size:14px;color:${kind === 'own' ? 'var(--fg)' : 'var(--muted)'};border-bottom:2px solid ${kind === 'own' ? 'var(--accent)' : 'transparent'};margin-bottom:-1px"'>individual project · '${label('own')}</a><a role="tab" aria-selected="${kind === 'tribunal'}" href="/projects?kind=tribunal" style="text-decoration:none;display:inline-flex;align-items:center;min-height:46px;padding:0 16px;font-family:var(--mono);font-size:14px;color:${kind === 'tribunal' ? 'var(--fg)' : 'var(--muted)'};border-bottom:2px solid ${kind === 'tribunal' ? 'var(--accent)' : 'transparent'};margin-bottom:-1px">tribunal · ${label('tribunal')}</a></div>
   <div class="cols" style="align-items:flex-start;gap:28px"><div style="--b:560px;flex:999 1 560px">${err}${form}${body}</div><div class="stack" style="flex:1 1 280px">${rulesMarkup(d.prog)}${hist}</div></div></div>`;
}

// ---------- Exam finale ----------
export function noExamPage(ctx) {
  const home = ctx.role === 'teacher' ? '/teacher/progress' : '/program';
  return `<div class="wrap page" style="max-width:820px">${head('exam --status', 'No final exam', 'Your program has no final exam. Your grade comes from your class engagement and your 2 projects, as My program describes.')}<a class="btn sec" href="${home}">Open My program</a></div>`;
}
const SAMPLE_READY = [
  { state: 'ok', title: 'Study the modules taught so far', text: '8 of 8 studied' }, { state: 'ok', title: 'Answer at least 80% of live exercises', text: '95% answered' },
  { state: 'warn', title: 'Reach 70% in practice for each part', text: 'part 1: 82%, part 2: 64%' }, { state: 'bad', title: 'Individual project passes every check', text: '1 check failed' },
  { state: 'none', title: 'Tribunal submitted and passes every check', text: 'not submitted' }, { state: 'ok', title: 'Take at least 1 practice exam', text: '1 taken, score 72%' }];

export function examPage(ctx) {
  if (!signedIn(ctx)) {
    return `<div class="wrap page">${head('exam --status', 'Exam finale', `Your program ends with a final exam. Before it, ${agS('examiner')} shows how ready you are, condition by condition, and runs practice exams on the modules taught so far.`, ag('examiner'))}
     ${steps([['Follow your readiness', '@examiner checks your modules, live answers, practice results and projects against the conditions for the exam.'], ['Practice', 'Practice exams of about 20 questions show where you are weak. They never count towards the grade.'], ['Sit the exam', 'Part A has closed questions. In part B you direct an agent on a small task and submit the session record.'], ['Your teacher grades', '@examiner marks the closed questions. Your teacher reviews every exam and sets the mark.']])}
     <div class="cols section" style="align-items:flex-start"><div style="--b:440px;flex:999 1 440px">${exFrame('readiness for the exam', readyMarkup(SAMPLE_READY))}</div><div style="--b:320px">${examMarkup()}</div></div>
     ${signStrip('Sign in to see your readiness and take practice exams.', ['your readiness for the exam, condition by condition', 'practice exams on the modules taught so far', 'the date, format and rules of your exam'])}</div>`;
  }
  const d = studentData(ctx);
  return `<div class="wrap page">${head('exam --status', 'Exam finale', 'Follow your readiness for the final exam, take practice exams, and find everything about the exam day.', ag('examiner') + '<span class="sample">draft format</span>')}
   <div class="cols" style="align-items:flex-start"><div style="--b:440px;flex:999 1 440px">${readyMarkup(d.ready.conds)}</div>
   <div class="stack" style="flex:1 1 320px">${examMarkup()}<div class="card"><p class="ch">practice exam</p><p class="fg2" style="margin:0 0 12px">Practice exams of 20 questions on the modules taught so far open later in the course. Practice scores never count towards the grade.</p><button type="button" class="btn sec wide" disabled>Practice exams open later</button></div></div></div>
   <div class="section card"><p class="ch">rules for the exam day <span class="r">draft</span></p><div class="cols" style="--b:240px;gap:16px">
   ${[['Sign in', 'Sign in with the same address you use in the course.'], ['Tools', 'In part B you may use the agent tools that your teacher allows.'], ['Record', 'Keep the full record of your session with the agent. It is part of your answer.'], ['Questions', 'During the exam, ask the teacher, not @tutor. The tutor is closed during the exam.']].map(x => `<div><p style="margin:0 0 4px;font-weight:800">${x[0]}</p><p class="fg2" style="margin:0;font-size:15px">${x[1]}</p></div>`).join('')}
   </div></div></div>`;
}

// ---------- My progress ----------
export function progressPage(ctx) {
  if (!signedIn(ctx)) {
    const ME = [80, 80, 100, 60, 80, 40, 80, 100], GRP = [78, 74, 81, 69, 72, 66, 75, 79];
    const ex = tilesMarkup({ answered: '38<small> of 40</small>', answeredSub: '95% · group average 85%', score: '78%', scoreSub: 'group average 74%', practice: '75%', practiceSub: 'part 1: 82% · part 2: 64%', modules: '8<small> of 19</small>', modulesSub: 'module 9 in progress', projects: '0<small> of 2</small>', projectsSub: 'individual: 1 failed · tribunal: not yet', ready: '3<small> of 6</small>' }, hasExam('ase'))
      + `<div class="card" style="margin-top:16px"><p class="ch">live exercise score by lesson <span class="r">you and your group</span></p><div class="legend"><span><i></i>You</span><span><i class="ref"></i>Group average</span></div>${scoreChart(ME, GRP, ME.map((_, i) => 'L' + (i + 1)))}</div>`;
    return `<div class="wrap page">${head('progress --me', 'My progress', 'This page shows how you are doing in your program, set against the average of your group. Only you see your own figures.', ag('analyst'))}
     ${exFrame('the progress of a student', ex)}
     <div class="cols section"><div class="card" style="--b:300px"><p class="ch">what the page shows</p><div class="ticks" style="margin:0">${['your answers and scores in each lesson', 'the modules you have studied and your practice results', 'the checks of your projects', 'your readiness for the exam', 'messages from your agents on what to do next'].map(t => `<p>${I.check}<span>${t}</span></p>`).join('')}</div></div>
     <div class="card" style="--b:300px"><p class="ch">your ratings</p><h3 class="h3">Your ratings stay anonymous</h3><p class="fg2" style="margin:0;font-size:15px">You see your own lesson ratings beside the group average. Your teacher sees ratings only as totals from 5 or more students, and ratings never affect grades.</p></div></div>
     ${signStrip('Sign in to see your own progress.', [`your figures for every lesson, module and project${hasExam('ase') ? ' and practice exam' : ''}`, 'your figures set against the average of your group', 'suggestions from @tutor, @reviewer and @examiner'])}</div>`;
  }
  const d = studentData(ctx);
  const info = groupInfo(ctx);
  const groupEng = M.avg(d.matrix.people.map(p => M.personLive(d.matrix, p.id).eng));
  const groupScore = M.avg(d.avgs.map(a => a.score));
  const withContent = Object.keys(d.prac).map(Number);
  const studied = withContent.filter(n => d.prac[n].studied).length;
  const pa = M.partAccuracy(d.prac, d.g.programme);
  const prAcc = M.avg(Object.values(d.prac).map(p => p.accuracy));
  const own = M.projectState(d.projs.own), trib = M.projectState(d.projs.tribunal);
  const passing = [own, trib].filter(s => s === 'passed').length;
  const tilesHtml = tilesMarkup({
    answered: `${d.live.answered}<small> of ${d.live.opened}</small>`, answeredSub: d.live.eng == null ? 'no lessons held yet' : `${d.live.eng}%${groupEng == null ? '' : ` · group average ${Math.round(groupEng)}%`}`,
    score: d.live.score == null ? '–' : `${d.live.score}%`, scoreSub: groupScore == null ? '' : `group average ${Math.round(groupScore)}%`,
    practice: prAcc == null ? '–' : `${Math.round(prAcc)}%`, practiceSub: Object.entries(pa).map(([k, v]) => `part ${k}: ${v}%`).join(' · '),
    modules: `${studied}<small> of ${d.prog.modules.length}</small>`, modulesSub: `${withContent.length} with study pages so far`,
    projects: `${passing}<small> of 2</small>`, projectsSub: `individual: ${own === 'none' ? 'not yet' : own} · tribunal: ${trib === 'none' ? 'not yet' : trib}`,
    ready: `${d.ready.met}<small> of ${d.ready.conds.length}</small>`,
  }, hasExam(d.g.programme));
  const labels = d.matrix.lessons.map(l => 'L' + l.number);
  const msgs = [];
  const weak = withContent.filter(n => d.prac[n].accuracy != null && d.prac[n].accuracy < 70)[0];
  if (weak) msgs.push(['tutor', `Your practice score on module ${weak} was ${d.prac[weak].accuracy}%. Read its key ideas again before the next lesson.`]);
  if (d.projs.own.last && d.projs.own.last.failed) msgs.push(['reviewer', `Your individual project has ${d.projs.own.last.failed} failed check${d.projs.own.last.failed > 1 ? 's' : ''}. Fix ${d.projs.own.last.failed > 1 ? 'them' : 'it'} and run the check again.`]);
  if (own === 'none') msgs.push(['reviewer', 'You have not submitted your individual project yet.']);
  if (hasExam(d.g.programme)) msgs.push(['examiner', `You meet ${d.ready.met} of ${d.ready.conds.length} exam conditions.`]);
  const liveL = M.liveLesson(d.g.id);
  if (liveL) msgs.push(['proctor', `Lesson ${liveL.number} is running now. Open Learn in class.`]);
  const toRate = M.lessonToRate(ctx.user);
  if (toRate && !toRate.mine) msgs.push(['analyst', `You have not rated lesson ${toRate.lesson.number} yet. It takes a few seconds and stays anonymous.`]);
  const mods = d.prog.modules.map(m => {
    const p = d.prac[m.n];
    const c = p && p.studied ? 'm-done' : p && p.done ? 'm-now' : 'm-open';
    const tip = `Module ${m.n}: ${m.title}\n${!p ? 'study page not ready' : p.studied ? `studied${p.accuracy != null ? `, practice ${p.accuracy}%` : ''}` : p.done ? 'in progress' : 'not started'}`;
    return p ? `<a href="/study/${m.n}" class="${c}" data-tip="${esc(tip)}">${pad(m.n)}</a>` : `<span class="${c}" data-tip="${esc(tip)}">${pad(m.n)}</span>`;
  }).join('');
  const less = d.matrix.lessons.map((l, i) => `<div class="li" style="padding:9px 0"><span class="n">L${l.number}</span><span style="flex:1 1 140px;min-width:0">${squares(d.live.cells[i].answered, l.opened)}</span><span class="mono small">${d.live.cells[i].answered} / ${l.opened} · group ${d.avgs[i].avgAnswered.toFixed(1)}</span></div>`).join('');
  const rated = M.ratingsByLesson(d.g.id);
  const rates = rated.map(r => { const mine = M.myLessonRating(ctx.user.id, r.id); return `<tr><td class="m">${r.number}</td><td>${esc(lessonTitle(d.g.programme, r))}</td><td class="m">${mine ? mine.rating + ' / 5' : '<a href="/class">rate now</a>'}</td><td class="m">${r.n >= M.MIN_GROUP ? r.avg.toFixed(1) + ' / 5' : 'fewer than 5 ratings'}</td></tr>`; }).join('');
  return `<div class="wrap page">${head('progress --me', 'My progress', `${esc(info.who)} · ${esc(d.prog.title)} · ${esc(info.instS)} · group ${esc(info.group)}`, ag('analyst'))}
   ${tilesHtml}
   <div class="cols section" style="align-items:flex-start"><div class="card" style="--b:520px;flex:999 1 520px"><p class="ch">live exercise score by lesson <span class="r">you and your group</span></p>
   ${labels.length ? `<div class="legend"><span><i></i>You</span><span><i class="ref"></i>Group average</span></div>${scoreChart(d.live.scores, d.avgs.map(a => a.score), labels)}<details class="data"><summary>show as a table</summary><div class="scroll"><table class="tbl"><thead><tr><th>lesson</th><th>you</th><th>group average</th></tr></thead><tbody>${d.matrix.lessons.map((l, i) => `<tr><td class="m">${l.number}</td><td class="m">${d.live.scores[i] == null ? '–' : d.live.scores[i] + '%'}</td><td class="m">${d.avgs[i].score == null ? '–' : d.avgs[i].score + '%'}</td></tr>`).join('')}</tbody></table></div></details>` : '<p class="fg2" style="margin:0">The chart appears after the first lesson.</p>'}</div>
   <div class="card" style="flex:1 1 320px"><p class="ch">from your agents</p><div class="log">${msgs.map(x => `<div class="l"><span class="a">@${x[0]}</span><span class="x">${esc(x[1])}</span></div>`).join('')}</div></div></div>
   <div class="cols section" style="align-items:flex-start"><div class="card" style="--b:360px"><p class="ch">modules <span class="r">${d.prog.modules.length}</span></p><div class="mods">${mods}</div><div class="heatkey"><span><i style="background:var(--accent)"></i>studied</span><span><i style="border:2px solid var(--accent);box-sizing:border-box"></i>in progress</span><span><i style="border:1px solid var(--line);box-sizing:border-box"></i>not started</span></div></div>
   <div class="card" style="--b:360px"><p class="ch">live exercises answered <span class="r">per lesson</span></p>${less || '<p class="fg2" style="margin:0">No lessons held yet.</p>'}</div></div>
   ${rated.length ? `<div class="section card"><p class="ch">your lesson ratings <span class="r">visible only to you</span></p><p class="fg2" style="margin:0 0 12px;font-size:15px">Your ratings stay anonymous to the teacher. Here you can compare them with the average of your group, which appears once 5 students have rated a lesson.</p><div class="scroll"><table class="tbl" style="min-width:560px"><thead><tr><th>lesson</th><th>module</th><th>your rating</th><th>group average</th></tr></thead><tbody>${rates}</tbody></table></div></div>` : ''}
   </div>`;
}
