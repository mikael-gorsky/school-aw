// The request handler: sessions, the routes and the security rules that apply
// to every request. server/main.js starts it; the tests start it on a free port.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, secureCookies } from './config.js';
import { all, get, run, now, log, setting, setSetting } from './db.js';
import { COOKIE, createSession, sessionUser, endSession, admit, demoLogin, googleStart, googleFinish, applyProfile, normEmail } from './auth.js';
import { layout, HOME } from './html.js';
import { programme, hasExam, planLesson } from './content.js';
import * as M from './model.js';
import * as P from './pages/public.js';
import * as S from './pages/student.js';
import * as T from './pages/teacher.js';
import * as A from './pages/account.js';
import { resetDemo } from './demo.js';
import { readPermitCsv, readPermitList, isEmail } from './csv.js';
import { parseRepo, checkRepository } from './reviewer.js';
import { aiAvailable, askTutor, groupThemes } from './ai.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = {
  '/static/app.css': [path.join(ROOT, 'public/app.css'), 'text/css; charset=utf-8'],
  '/static/app.js': [path.join(ROOT, 'public/app.js'), 'text/javascript; charset=utf-8'],
  // The CSV reader runs in the browser, so that a Moodle export never leaves the
  // teacher's computer with its other columns (decision of 27 October 2026).
  '/static/csv.js': [path.join(ROOT, 'server/csv.js'), 'text/javascript; charset=utf-8'],
};
const STU = ['student', 'demo'];
const TEACHER = ['teacher'];

// ---------- small helpers ----------
const one = v => (Array.isArray(v) ? v[0] : v);
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v, max = 4000) => String(one(v) ?? '').trim().slice(0, max);

function parseCookies(h) {
  const o = {};
  for (const part of String(h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return o;
}
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies() ? '; Secure' : ''}`;
}
function parseForm(text) {
  const o = {};
  for (const [k, v] of new URLSearchParams(text)) o[k] = k in o ? [].concat(o[k], v) : v;
  return o;
}
function readBody(req, limit = 2e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('The request is too large.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// A form may be sent only from the site itself. The session cookie is also
// SameSite=Lax, so this is a second guard against requests from other sites.
function sameOrigin(req) {
  const o = req.headers.origin || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch { return 'null'; } })() : null);
  if (!o) return true;
  if (o === 'null') return false;
  let host;
  try { host = new URL(o).host; } catch { return false; }
  const allowed = [req.headers['x-forwarded-host'], req.headers.host, new URL(config.baseUrl).host].filter(Boolean);
  return allowed.includes(host);
}

const hits = new Map();
function limited(key, max, ms) {
  const t = Date.now();
  const list = (hits.get(key) || []).filter(x => t - x < ms);
  list.push(t);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const SECURITY = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------- routes ----------
const routes = [];
function on(method, pattern, opts, fn) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(`^${pattern}$`);
  routes.push({ method, re, opts, fn });
}

// School pages, open to everyone.
on('GET', '/', { title: 'Home' }, ctx => P.home(ctx));
on('GET', '/agents', { title: 'The agents' }, () => P.agents());
on('GET', '/privacy', { title: 'Privacy notice' }, () => P.privacy());
on('GET', '/contact', { title: 'Contact SAW' }, ctx => P.contact(ctx));
on('POST', '/contact', {}, ctx => {
  const email = normEmail(str(ctx.form.email, 200));
  const body = str(ctx.form.body, 4000);
  if (!isEmail(email) || !body) return { redirect: '/contact?e=1' };
  if (limited(`contact:${ctx.ip}`, 5, 3600e3)) return { redirect: '/contact?e=1', flash: 'You have sent several messages in the last hour. Please wait before you send another.' };
  const topics = ['Registration and signing in', 'My programme', 'Something else'];
  const topic = topics.includes(str(ctx.form.topic)) ? str(ctx.form.topic) : 'Something else';
  run('INSERT INTO messages(name, email, topic, body, at) VALUES(?, ?, ?, ?, ?)', str(ctx.form.name, 120) || null, email, topic, body, now());
  log('steward', 'passed a message from Contact SAW to the teacher');
  return { redirect: '/contact?sent=1' };
});
on('GET', '/signin', { title: 'Sign in' }, ctx => (ctx.role === 'visitor' ? P.signin(ctx) : { redirect: HOME[ctx.role] }));
on('GET', '/register', { title: 'Register' }, ctx => {
  if (ctx.query.done && ctx.role !== 'visitor') return P.register({ ...ctx, programme: ctx.group ? programme(ctx.group.programme) : null });
  return ctx.role === 'visitor' ? P.register(ctx) : { redirect: HOME[ctx.role] };
});
on('GET', '/healthz', {}, () => ({ text: 'ok' }));

// ---------- sign-in ----------
async function signInAs(ctx, email, intent, profile) {
  const a = admit(email);
  if (a.refused) return { redirect: `/${intent === 'register' ? 'register' : 'signin'}?e=refused` };
  // The profile is stored only for an address that was admitted.
  await applyProfile(a.user.id, profile);
  const token = createSession(a.user.id);
  const role = a.user.role === 'teacher' ? 'teacher' : 'student';
  return { redirect: a.isNew ? '/register?done=1' : HOME[role], cookies: [cookie(COOKIE, token, 30 * 86400)] };
}
on('GET', '/auth/google', {}, ctx => {
  const url = googleStart(ctx.query.intent);
  return { redirect: url || '/signin' };
});
on('GET', '/auth/google/callback', {}, async ctx => {
  if (ctx.query.error) return { redirect: `/signin?e=${encodeURIComponent('Google sign-in was cancelled.')}` };
  try {
    const { email, intent, profile } = await googleFinish(ctx.query);
    return await signInAs(ctx, email, intent, profile);
  } catch (e) {
    return { redirect: `/signin?e=${encodeURIComponent(e.message)}` };
  }
});
on('POST', '/auth/dev', {}, ctx => {
  if (!config.devLogin) return { status: 404, title: 'Not found', body: P.notFound() };
  return signInAs(ctx, str(ctx.form.email, 200), str(ctx.form.intent));
});
on('POST', '/auth/demo', {}, ctx => {
  if (limited(`demo:${ctx.ip}`, 10, 600e3)) return { redirect: '/signin?e=demo' };
  const user = demoLogin(str(ctx.form.login, 40), one(ctx.form.password));
  if (!user) return { redirect: '/signin?e=demo' };
  run('INSERT INTO demo_visits(path, at) VALUES(?, ?)', '/auth/demo', now());
  return { redirect: '/programme', cookies: [cookie(COOKIE, createSession(user.id), 30 * 86400)] };
});
// ---------- my account ----------
// The name in the header opens this page, which also holds Sign out
// (decision of 31 October 2026).
on('GET', '/account', { title: 'My account' }, ctx => A.accountPage(ctx));
on('POST', '/account', { roles: ['student', 'demo', 'teacher'] }, ctx => {
  // Names are saved even when empty, so that neither the list nor Google
  // fills them again: the user decides their own name.
  run('UPDATE users SET first_name = ?, last_name = ?, comment = ? WHERE id = ?',
    str(ctx.form.first_name, 80), str(ctx.form.last_name, 80), str(ctx.form.comment, A.COMMENT_MAX) || null, ctx.user.id);
  return { redirect: '/account', flash: 'Your account is saved.' };
});
// A photo is open to its owner and to the teacher, and to nobody else.
on('GET', /^\/photo\/(\d+)$/, { roles: ['student', 'demo', 'teacher'] }, (ctx, id) => {
  if (ctx.role !== 'teacher' && Number(id) !== ctx.user.id) return { status: 404, title: 'Not found', body: P.notFound() };
  const ph = get('SELECT type, data FROM user_photos WHERE user_id = ?', Number(id));
  if (!ph) return { status: 404, text: 'No photo' };
  return { text: Buffer.from(ph.data), type: ph.type, headers: { 'cache-control': 'private, max-age=3600' } };
});
on('POST', '/auth/signout', {}, ctx => {
  endSession(ctx.cookies[COOKIE]);
  return { redirect: '/', cookies: [cookie(COOKIE, '', 0)] };
});

// ---------- the student side ----------
// The teacher has his own version of each section under /teacher.
const toTeacher = k => ctx => (ctx.role === 'teacher' ? { redirect: `/teacher/${k}${ctx.groupQuery}` } : null);
on('GET', '/programme', { title: 'My programme' }, ctx => toTeacher('progress')(ctx) || S.programmePage(ctx));
on('GET', '/class', { title: 'Learn in class' }, ctx => toTeacher('class')(ctx) || S.classPage(ctx));
on('GET', '/study', { title: 'Study alone' }, ctx => toTeacher('study')(ctx) || S.studyPage(ctx));
on('GET', '/projects', { title: 'Submit projects' }, ctx => toTeacher('projects')(ctx) || S.projectsPage(ctx));
const examProg = ctx => (ctx.group ? ctx.group.programme : 'ase');
on('GET', '/exam', { title: 'Exam finale' }, ctx => toTeacher('exam')(ctx) || (hasExam(examProg(ctx)) ? S.examPage(ctx) : S.noExamPage(ctx)));
on('GET', '/progress', { title: 'My progress' }, ctx => toTeacher('progress')(ctx) || S.progressPage(ctx));
on('GET', /^\/study\/(\d{1,2})$/, { title: 'Study page' }, (ctx, n) => {
  if (ctx.role === 'visitor') return { redirect: '/study' };
  if (!ctx.group) return { redirect: '/teacher/access' };
  const prog = programme(ctx.group.programme);
  if (!prog.modules.some(m => m.n === Number(n))) return { status: 404, title: 'Not found', body: P.notFound() };
  return S.modulePage(ctx, Number(n));
});
on('GET', '/class/live', { roles: STU }, ctx => ({ json: S.livePartial(ctx) }));

on('POST', '/api/live/answer', { roles: STU }, ctx => {
  const it = get('SELECT i.*, l.group_id FROM items i JOIN lessons l ON l.id = i.lesson_id WHERE i.id = ?', Number(one(ctx.form.item)));
  const choice = str(ctx.form.choice, 4);
  if (!it || it.group_id !== ctx.user.group_id || it.state !== 'open' || (it.closes_at && it.closes_at < now())) return { status: 409, json: { error: 'This exercise is closed.' } };
  if (!JSON.parse(it.options).some(o => o[0] === choice)) return { status: 400, json: { error: 'Choose one of the answers.' } };
  run(`INSERT INTO answers(item_id, user_id, choice, at) VALUES(?, ?, ?, ?)
       ON CONFLICT(item_id, user_id) DO UPDATE SET choice = excluded.choice, at = excluded.at`, it.id, ctx.user.id, choice, now());
  return { json: { ok: true } };
});
on('POST', '/class/rate', { roles: STU }, ctx => {
  const ok = M.saveLessonRating(ctx.user, Number(one(ctx.form.lesson)), one(ctx.form.rating),
    arr(ctx.form.helped).filter(h => S.HELPED.includes(h)), arr(ctx.form.blocked).filter(b => S.BLOCKED.includes(b)), str(ctx.form.comment, 1000));
  return { redirect: '/class', flash: ok ? 'Thank you. Your rating is recorded, and it is anonymous.' : 'Choose a rating from 1 to 5.' };
});
on('POST', '/survey', { roles: STU }, ctx => {
  const ok = M.saveSurvey(ctx.user, Number(one(ctx.form.survey)), Object.fromEntries(Object.entries(ctx.form).map(([k, v]) => [k, one(v)])));
  return { redirect: '/class', flash: ok ? 'Thank you. Your survey answers are recorded, and they are anonymous.' : 'The survey is closed.' };
});
on('POST', /^\/study\/(\d{1,2})\/practice$/, { roles: STU }, (ctx, n) => {
  const ex = str(ctx.form.exercise, 40);
  M.savePractice(ctx.user.id, ctx.group.programme, Number(n), ex, str(ctx.form.answer, 4000));
  return { redirect: `/study/${Number(n)}#${encodeURIComponent(ex)}` };
});
on('POST', /^\/study\/(\d{1,2})\/rate$/, { roles: STU }, (ctx, n) => {
  const ok = M.saveModuleRating(ctx.user, Number(n), one(ctx.form.clarity));
  return { redirect: `/study/${Number(n)}`, flash: ok ? 'Thank you. Your rating is anonymous.' : 'Choose a rating from 1 to 5.' };
});
on('POST', '/api/tutor', { roles: STU }, async ctx => {
  const q = str(ctx.form.question, 1500);
  if (!q) return { status: 400, json: { error: 'Write a question first.' } };
  if (!aiAvailable()) return { status: 503, json: { error: 'The tutor is not connected yet. Ask your teacher through Contact SAW.' } };
  const day = new Date().toISOString().slice(0, 10);
  const used = (get('SELECT count FROM tutor_usage WHERE user_id = ? AND day = ?', ctx.user.id, day) || { count: 0 }).count;
  if (used >= 20) return { status: 429, json: { error: 'You have asked 20 questions today. You can ask again tomorrow.', left: 0 } };
  run('INSERT INTO tutor_usage(user_id, day, count) VALUES(?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1', ctx.user.id, day);
  const left = 19 - used;
  try {
    // Only the question text goes to the AI service: no name and no address.
    const a = await askTutor(q, ctx.group.programme);
    if (a.passed) {
      run('INSERT INTO tutor_passed(programme, question, at) VALUES(?, ?, ?)', ctx.group.programme, q, now());
      log('tutor', 'passed a question outside the rules to the teacher');
      return { json: { passed: true, text: 'The rules do not answer this question, so @tutor has passed it to your teacher without your name. The answer will appear on the Study alone page.', left } };
    }
    log('tutor', 'answered a question from the rules');
    return { json: { answer: a.answer, source: a.source, left } };
  } catch {
    return { status: 502, json: { error: 'The tutor could not answer just now. Try again in a minute.', left } };
  }
});
on('POST', '/projects/submit', { roles: STU }, async ctx => {
  const kind = str(ctx.form.kind) === 'tribunal' ? 'tribunal' : 'own';
  const back = `/projects?kind=${kind}`;
  const ref = parseRepo(str(ctx.form.repo, 300));
  if (!ref) return { redirect: `${back}&e=${encodeURIComponent('Use the address of a GitHub repository, such as https://github.com/name/project.')}` };
  run(`INSERT INTO projects(user_id, kind, repo, submitted_at) VALUES(?, ?, ?, ?)
       ON CONFLICT(user_id, kind) DO UPDATE SET repo = excluded.repo`, ctx.user.id, kind, ref.url, now());
  const pr = get('SELECT * FROM projects WHERE user_id = ? AND kind = ?', ctx.user.id, kind);
  const last = get('SELECT at FROM checks WHERE project_id = ? ORDER BY at DESC LIMIT 1', pr.id);
  if (last && Date.now() - Date.parse(last.at) < 60e3) return { redirect: back, flash: 'The last check ran less than a minute ago. Wait a minute and run it again.' };
  const c = await checkRepository(ref.url);
  if (c.error) return { redirect: `${back}&e=${encodeURIComponent(c.error)}` };
  const n = st => c.results.filter(r => r.state === st).length;
  run('INSERT INTO checks(project_id, at, results, passed, warnings, failed, feedback) VALUES(?, ?, ?, ?, ?, ?, ?)', pr.id, now(), JSON.stringify(c.results), n('ok'), n('warn'), n('bad'), c.feedback);
  log('reviewer', `checked ${kind === 'own' ? 'an own project' : 'a tribunal'}: ${n('bad')} failed, ${n('warn')} warning`);
  return { redirect: back, flash: `@reviewer finished the check: ${n('ok')} passed, ${n('warn')} warning, ${n('bad')} failed.` };
});

// ---------- the teacher side ----------
// Every route here requires the teacher role. The demo login is a student and
// is refused (decision of 31 October 2026).
const back = (ctx, p, flash) => ({ redirect: `${p}${ctx.group ? `?group=${ctx.group.id}` : ''}`, flash });
on('GET', '/teacher/class', { roles: TEACHER, title: 'Learn in class' }, ctx => T.tClass(ctx));
on('GET', '/teacher/class/live', { roles: TEACHER }, ctx => ({ json: ctx.group ? T.consolePartial(ctx) : { key: 'none', html: '' } }));
on('GET', '/teacher/study', { roles: TEACHER, title: 'Study alone' }, ctx => T.tStudy(ctx));
on('GET', '/teacher/projects', { roles: TEACHER, title: 'Submit projects' }, ctx => T.tProjects(ctx));
on('GET', '/teacher/exam', { roles: TEACHER, title: 'Exam finale' }, ctx => (hasExam(examProg(ctx)) ? T.tExam(ctx) : S.noExamPage(ctx)));
on('GET', '/teacher/progress', { roles: TEACHER, title: 'Class progress' }, ctx => T.tProgress(ctx));
on('GET', '/teacher/satisfaction', { roles: TEACHER, title: 'Satisfaction' }, ctx => T.tSatisfaction(ctx));
on('GET', '/teacher/access', { roles: TEACHER, title: 'Groups and access' }, ctx => T.tAccess(ctx));
on('GET', '/teacher/agents', { roles: TEACHER, title: 'Agents' }, ctx => T.tAgents(ctx));
on('GET', /^\/teacher\/student\/(\d+)$/, { roles: TEACHER, title: 'Student' }, (ctx, id) => A.teacherStudentPage(ctx, Number(id)));
on('GET', '/teacher/export.csv', { roles: TEACHER }, ctx => {
  if (!ctx.group) return { redirect: '/teacher/access' };
  return { text: T.exportCsv(ctx), type: 'text/csv; charset=utf-8', headers: { 'content-disposition': `attachment; filename="saw-engagement-${ctx.group.code.replace(/[^\w-]/g, '')}.csv"` } };
});

on('POST', '/teacher/class/act', { roles: TEACHER }, ctx => {
  const g = ctx.group, f = ctx.form;
  if (!g) return { redirect: '/teacher/access' };
  const lessonOf = id => get('SELECT * FROM lessons WHERE id = ? AND group_id = ?', Number(one(id)), g.id);
  const itemOf = id => get('SELECT i.* FROM items i JOIN lessons l ON l.id = i.lesson_id WHERE i.id = ? AND l.group_id = ?', Number(one(id)), g.id);
  const a = str(f.action, 20);
  let flash;
  if (a === 'start') {
    const l = lessonOf(f.lesson);
    if (M.liveLesson(g.id)) flash = 'Another lesson is running. End it first.';
    else if (l && l.state === 'planned') { run("UPDATE lessons SET state = 'live' WHERE id = ?", l.id); log('proctor', `started lesson ${l.number} of ${M.groupLabel(g)}`); }
  } else if (a === 'release' || a === 'release-next') {
    let it = itemOf(f.item);
    if (it && a === 'release-next') it = get("SELECT * FROM items WHERE lesson_id = ? AND state = 'ready' ORDER BY seq LIMIT 1", it.lesson_id);
    if (it && it.state === 'ready') { M.openItem(it.id, 120); log('proctor', `released "${it.label}" on the teacher's signal`); }
  } else if (a === 'close' || a === 'minute' || a === 'show') {
    const it = itemOf(f.item);
    if (it && a === 'close' && it.state === 'open') run("UPDATE items SET state = 'closed', closes_at = ? WHERE id = ?", now(), it.id);
    if (it && a === 'minute' && it.state === 'open') run('UPDATE items SET closes_at = ? WHERE id = ?', new Date(Math.max(Date.now(), Date.parse(it.closes_at || now())) + 60e3).toISOString(), it.id);
    if (it && a === 'show' && it.state !== 'ready') { run("UPDATE items SET state = 'shown', closes_at = CASE WHEN state = 'open' THEN ? ELSE closes_at END WHERE id = ?", now(), it.id); log('proctor', `showed the results of "${it.label}" to the class`); }
  } else if (a === 'end') {
    const l = lessonOf(f.lesson);
    if (l && l.state === 'live') {
      run("UPDATE items SET state = 'shown', closes_at = ? WHERE lesson_id = ? AND state = 'open'", now(), l.id);
      run("UPDATE lessons SET state = 'ended' WHERE id = ?", l.id);
      log('analyst', `opened the rating of lesson ${l.number} of ${M.groupLabel(g)}`);
      flash = `Lesson ${l.number} has ended. Students can now rate it.`;
    }
  } else if (a === 'add-lesson') {
    const number = Number(one(f.number));
    // With a lesson plan the lesson number decides the modules; otherwise the teacher picks 1.
    const mod = planLesson(g.programme, number) ? planLesson(g.programme, number).modules[0] : Number(one(f.module));
    const zoom = str(f.zoom, 300);
    if (!(number >= 1 && number <= 99) || !programme(g.programme).modules.some(m => m.n === mod)) flash = programme(g.programme).lessons ? `Choose a lesson from 1 to ${programme(g.programme).lessons.length}.` : 'Give a lesson number and a module.';
    else if (get('SELECT 1 FROM lessons WHERE group_id = ? AND number = ?', g.id, number)) flash = `Lesson ${number} already exists in this group.`;
    else if (zoom && !/^https:\/\/[^\s"<>]+$/.test(zoom)) flash = 'The Zoom link must start with https://.';
    else { M.addLesson(g.id, number, mod, T.fromLocalInput(str(f.starts, 20)), zoom || null); flash = `Lesson ${number} is added.`; }
  } else if (a === 'add-item') {
    const l = lessonOf(f.lesson);
    const opts = ['a', 'b', 'c', 'd'].map(k => [k, str(f[`opt_${k}`], 200)]).filter(o => o[1]);
    const q = str(f.question, 400);
    const correct = opts.some(o => o[0] === str(f.correct)) ? str(f.correct) : null;
    if (!l || !q || opts.length < 2) flash = 'Write a question and at least 2 options.';
    else {
      const seq = (get('SELECT MAX(seq) AS s FROM items WHERE lesson_id = ?', l.id).s || 0) + 1;
      run('INSERT INTO items(lesson_id, seq, label, question, options, correct) VALUES(?, ?, ?, ?, ?, ?)', l.id, seq, 'Added item', q, JSON.stringify(opts), correct);
      flash = 'The item is added to the lesson plan.';
    }
  }
  return back(ctx, '/teacher/class', flash);
});
on('POST', '/teacher/study/answer', { roles: TEACHER }, ctx => {
  const q = get('SELECT * FROM tutor_passed WHERE id = ?', Number(one(ctx.form.id)));
  if (!q) return back(ctx, '/teacher/study');
  if (str(ctx.form.do) === 'ignore') { run('UPDATE tutor_passed SET handled = 1 WHERE id = ?', q.id); return back(ctx, '/teacher/study', 'The question is set aside.'); }
  const answer = str(ctx.form.answer, 2000);
  if (!answer) return back(ctx, '/teacher/study', 'Write an answer first.');
  run('UPDATE tutor_passed SET answer = ?, handled = 1 WHERE id = ?', answer, q.id);
  if (one(ctx.form.rule) === '1') {
    const key = `tutor_answers:${q.programme}`;
    setSetting(key, `${setting(key, '')}Q: ${q.question}\nA: ${answer}\n\n`.slice(-20000));
    log('tutor', 'will use a new answer from the teacher');
  }
  return back(ctx, '/teacher/study', 'Your answer is published on the Study alone page.');
});
on('POST', '/teacher/exam/settings', { roles: TEACHER }, ctx => {
  for (const k of ['exam_date', 'exam_length', 'exam_where', 'exam_weightA', 'exam_weightB', 'weight_live', 'weight_own', 'weight_tribunal', 'weight_exam']) {
    if (k in ctx.form) setSetting(k, str(ctx.form[k], 80));
  }
  return back(ctx, '/teacher/exam', 'Settings saved. Students see them on the exam page.');
});
on('POST', '/teacher/satisfaction/survey', { roles: TEACHER }, ctx => {
  const g = ctx.group;
  if (!g) return { redirect: '/teacher/access' };
  if (str(ctx.form.action) === 'open') {
    const labels = ['First survey', 'Mid-course survey', 'End-of-course survey'];
    const label = labels.includes(str(ctx.form.label)) ? str(ctx.form.label) : labels[0];
    if (!M.openSurvey(g.id)) { run("INSERT INTO surveys(group_id, label, state, opened_at) VALUES(?, ?, 'open', ?)", g.id, label, now()); log('analyst', `opened the ${label.toLowerCase()} for ${M.groupLabel(g)}`); }
    return back(ctx, '/teacher/satisfaction', 'The survey is open. Students see it on the Learn in class page.');
  }
  run("UPDATE surveys SET state = 'closed' WHERE id = ? AND group_id = ?", Number(one(ctx.form.survey)), g.id);
  return back(ctx, '/teacher/satisfaction', 'The survey is closed.');
});
on('POST', '/teacher/satisfaction/themes', { roles: TEACHER }, async ctx => {
  const g = ctx.group;
  const s = M.satisfaction(g.id);
  if (s.comments.length < M.MIN_GROUP || !aiAvailable()) return back(ctx, '/teacher/satisfaction');
  try {
    // The comments carry no names, and the AI service receives only their text.
    const themes = await groupThemes(s.comments.map(c => c.text));
    setSetting(`themes:${g.id}`, JSON.stringify({ at: now(), n: s.comments.length, themes }));
    log('analyst', `grouped ${s.comments.length} comments into ${themes.length} themes`);
    return back(ctx, '/teacher/satisfaction', 'The comments are grouped into themes.');
  } catch {
    return back(ctx, '/teacher/satisfaction', 'The comments could not be grouped just now. Try again in a minute.');
  }
});

// Names given by the teacher are kept on the list. They fill a user's empty
// names, and a name the user wrote on My account always stays
// (decision of 31 October 2026).
function permitTo(groupId, email, first = '', last = '') {
  run(`INSERT INTO permitted(email, group_id, added_at, first_name, last_name) VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET group_id = excluded.group_id,
         first_name = COALESCE(excluded.first_name, permitted.first_name), last_name = COALESCE(excluded.last_name, permitted.last_name)`,
  email, groupId, now(), first || null, last || null);
  run("UPDATE users SET group_id = ? WHERE email = ? AND role = 'student'", groupId, email);
  run('UPDATE refused SET handled = 1 WHERE email = ?', email);
}
on('POST', '/teacher/access/permit', { roles: TEACHER }, ctx => {
  const institution = str(ctx.form.institution, 120), code = str(ctx.form.code, 40);
  const prog = str(ctx.form.programme, 20) || 'ase';
  try { programme(prog); } catch { return back(ctx, '/teacher/access', 'Choose a programme.'); }
  // Only the names, email, group and institution of each row are used; nothing else is stored.
  const rows = [...readPermitList(one(ctx.form.emails)).map(email => ({ email })), ...readPermitCsv(one(ctx.form.csv))]
    .filter(r => r.email !== 'demo' && !config.teacherEmails.includes(r.email));
  if (!rows.length) return back(ctx, '/teacher/access', 'No email addresses were found.');
  // A group or institution in the file overrides the one in the form.
  const groupFor = (inst, c) => {
    run('INSERT OR IGNORE INTO groups(institution, code, programme, created_at) VALUES(?, ?, ?, ?)', inst, c, prog, now());
    return get('SELECT * FROM groups WHERE institution = ? AND code = ? AND programme = ?', inst, c, prog);
  };
  let first = null, added = 0, missing = 0;
  for (const r of rows) {
    const inst = r.institution || institution, c = r.group || code;
    if (!inst || !c) { missing++; continue; }
    const g = groupFor(inst, c);
    if (g.is_demo) continue;
    first = first || g;
    permitTo(g.id, r.email, r.first, r.last);
    added++;
  }
  const msg = [added ? `${added} address${added > 1 ? 'es are' : ' is'} on the list.` : '', missing ? `${missing} address${missing > 1 ? 'es have' : ' has'} no institution or group. Write them in the form and add again.` : ''].filter(Boolean).join(' ');
  return { redirect: `/teacher/access?group=${first ? first.id : ''}`, flash: msg };
});
on('POST', '/teacher/access/remove', { roles: TEACHER }, ctx => {
  const email = normEmail(str(ctx.form.email, 200));
  run('DELETE FROM permitted WHERE email = ? AND group_id IN (SELECT id FROM groups WHERE is_demo = 0)', email);
  run("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ? AND role = 'student')", email);
  return back(ctx, '/teacher/access', `${email} is removed from the list and can no longer sign in.`);
});
on('POST', '/teacher/access/refused', { roles: TEACHER }, ctx => {
  const email = normEmail(str(ctx.form.email, 200));
  if (str(ctx.form.action) === 'add') {
    const g = M.groupById(Number(one(ctx.form.to)));
    if (g && !g.is_demo && isEmail(email)) { permitTo(g.id, email); return { redirect: `/teacher/access?group=${g.id}`, flash: `${email} is on the list of ${M.groupLabel(g)}.` }; }
  }
  run('UPDATE refused SET handled = 1 WHERE email = ?', email);
  return back(ctx, '/teacher/access', `${email} is set aside.`);
});
on('POST', '/teacher/access/demo-reset', { roles: TEACHER }, () => {
  resetDemo();
  log('steward', 'reset the demo group on the teacher’s request');
  return { redirect: '/teacher/access', flash: 'The demo group is reset.' };
});
on('POST', '/teacher/access/message', { roles: TEACHER }, ctx => {
  run('UPDATE messages SET handled = 1 WHERE id = ?', Number(one(ctx.form.id)));
  return back(ctx, '/teacher/access', 'The message is marked as handled.');
});

// ---------- the request handler ----------
function contextFor(req, url, form, cookies) {
  let user = sessionUser(cookies[COOKIE]);
  if (user && user.role === 'sample') user = null;
  // A student whose address was removed from the list loses access at once.
  if (user && user.role === 'student') {
    const perm = get('SELECT group_id FROM permitted WHERE email = ?', user.email);
    if (!perm) { endSession(cookies[COOKIE]); user = null; }
    else if (perm.group_id !== user.group_id) { run('UPDATE users SET group_id = ? WHERE id = ?', perm.group_id, user.id); user.group_id = perm.group_id; }
  }
  const role = !user ? 'visitor' : user.role === 'teacher' ? 'teacher' : user.role === 'demo' ? 'demo' : 'student';
  const query = Object.fromEntries(url.searchParams);
  let group = null;
  if (role === 'student' || role === 'demo') group = M.groupById(user.group_id);
  if (role === 'teacher') {
    const gid = Number(query.group || one(form.group));
    group = (gid && M.groupById(gid)) || M.groupsAll().find(g => !g.is_demo) || M.groupsAll()[0] || null;
  }
  return {
    req, method: req.method, path: url.pathname, query, form, cookies, user, role, group,
    groupQuery: role === 'teacher' && group ? `?group=${group.id}` : '',
    ip: clientIp(req), db: { get, all }, flash: cookies.saw_flash || '',
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...(secureCookies() ? { 'strict-transport-security': 'max-age=31536000' } : {}), ...headers });
  res.end(body);
}

export async function handle(req, res) {
  const started = Date.now();
  let url;
  try { url = new URL(req.url, 'http://local'); } catch { return send(res, 400, 'Bad request'); }
  const p = url.pathname;

  if (req.method === 'GET' && STATIC[p]) {
    const [file, type] = STATIC[p];
    return fs.readFile(file, (err, data) => (err ? send(res, 404, 'Not found') : send(res, 200, data, { 'content-type': type, 'cache-control': 'no-cache' })));
  }
  if (p === '/favicon.ico') return send(res, 204, '');

  const route = routes.find(r => r.method === req.method && r.re.test(p));
  const cookies = parseCookies(req.headers.cookie);
  let form = {};
  try {
    if (req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, 'This form must be sent from the site itself.', { 'content-type': 'text/plain; charset=utf-8' });
      const text = await readBody(req);
      form = String(req.headers['content-type'] || '').includes('application/json') ? (JSON.parse(text || '{}') || {}) : parseForm(text);
    }
    const ctx = contextFor(req, url, form, cookies);
    let out;
    if (!route) out = { status: 404, title: 'Not found', body: P.notFound() };
    else if (route.opts.roles && !route.opts.roles.includes(ctx.role)) {
      if (ctx.role === 'visitor' && req.method === 'GET' && !route.opts.title) out = { status: 401, json: { error: 'Sign in first.' } };
      else if (ctx.role === 'visitor') out = { redirect: '/signin' };
      else out = { status: 403, title: 'Not open to you', body: P.forbidden(ctx.role === 'demo' ? 'The demo login is a sample student. It sees only the student side of the site.' : 'This page is open only to the teacher.') };
    } else {
      const m = p.match(route.re);
      out = await route.fn(ctx, ...m.slice(1));
    }
    if (out == null) out = { status: 404, title: 'Not found', body: P.notFound() };
    if (typeof out === 'string') out = { body: out, title: route.opts.title };

    const headers = {};
    const setCookies = [...(out.cookies || [])];
    if (ctx.flash && (out.body != null)) setCookies.push(cookie('saw_flash', '', 0));
    if (out.flash) setCookies.push(cookie('saw_flash', out.flash, 60));
    if (setCookies.length) headers['set-cookie'] = setCookies;
    let status = out.status || 200;
    if (out.redirect) { status = 303; headers.location = out.redirect; send(res, status, '', headers); }
    else if (out.json) { headers['content-type'] = 'application/json; charset=utf-8'; headers['cache-control'] = 'no-store'; send(res, status, JSON.stringify(out.json), headers); }
    else if (out.text != null) { headers['content-type'] = out.type || 'text/plain; charset=utf-8'; Object.assign(headers, out.headers || {}); send(res, status, out.text, headers); }
    else {
      if (ctx.role === 'demo' && req.method === 'GET') run('INSERT INTO demo_visits(path, at) VALUES(?, ?)', p, now());
      headers['content-type'] = 'text/html; charset=utf-8';
      headers['cache-control'] = 'no-store';
      send(res, status, layout(ctx, out.title || 'School of Agentic Work', out.body, ctx.flash && !out.flash ? ctx.flash : ''), headers);
    }
    if (process.env.SAW_LOG !== '0') console.log(`${req.method} ${p} ${status} ${Date.now() - started}ms`);
  } catch (e) {
    console.error(`${req.method} ${p} failed: ${e.stack || e.message}`);
    if (!res.headersSent) send(res, e.status || 500, e.status === 413 ? 'The request is too large.' : 'Something went wrong on the server. Please try again.', { 'content-type': 'text/plain; charset=utf-8' });
  }
}
