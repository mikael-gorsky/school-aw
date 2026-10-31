// Queries and figures shared by the student and teacher pages.
import { all, get, run, now, log, voterKey } from './db.js';
import { programme, moduleContent, lessonItems, modulesWithContent, partOf } from './content.js';

export const MIN_GROUP = 5; // ratings are shown only from 5 or more answers (decision of 29 October 2026)

export const avg = a => { const v = a.filter(x => x != null && !Number.isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// ---------- groups and members ----------
export const groupById = id => get('SELECT * FROM groups WHERE id = ?', id);
export const groupsAll = () => all('SELECT * FROM groups ORDER BY is_demo, institution, code');
export function members(groupId) {
  return all("SELECT * FROM users WHERE group_id = ? AND role IN ('student','demo','sample') ORDER BY email", groupId);
}
export function permittedOf(groupId) {
  return all(`SELECT p.email, p.added_at, u.id AS user_id, COALESCE(u.first_name, p.first_name) AS first_name, COALESCE(u.last_name, p.last_name) AS last_name, u.registered_at, u.last_seen
              FROM permitted p LEFT JOIN users u ON u.email = p.email WHERE p.group_id = ? ORDER BY p.email`, groupId);
}
export function instShort(name) {
  if (/holon institute of technology/i.test(name)) return 'HIT';
  return name;
}
export function groupLabel(g) {
  return g ? `${instShort(g.institution)} · group ${g.code}` : '';
}

// ---------- lessons and live items ----------
export const lessonsOf = groupId => all('SELECT * FROM lessons WHERE group_id = ? ORDER BY number', groupId);
export const itemsOf = lessonId => all('SELECT * FROM items WHERE lesson_id = ? ORDER BY seq', lessonId);
export const liveLesson = groupId => get("SELECT * FROM lessons WHERE group_id = ? AND state = 'live' ORDER BY number DESC LIMIT 1", groupId);
export const nextLesson = groupId => get("SELECT * FROM lessons WHERE group_id = ? AND state != 'ended' ORDER BY number LIMIT 1", groupId);
export const lastEnded = groupId => get("SELECT * FROM lessons WHERE group_id = ? AND state = 'ended' ORDER BY number DESC LIMIT 1", groupId);

// A lesson covers the modules the teacher chose, and copies the live
// exercises of each module in turn.
export function addLesson(groupId, number, modules, startsAt, zoomUrl) {
  const g = groupById(groupId);
  run('INSERT INTO lessons(group_id, number, module, modules, starts_at, zoom_url) VALUES(?, ?, ?, ?, ?, ?)', groupId, number, modules[0], JSON.stringify(modules), startsAt || null, zoomUrl || null);
  const lesson = get('SELECT * FROM lessons WHERE group_id = ? AND number = ?', groupId, number);
  lessonItemsFor(g.programme, modules).forEach((it, i) => {
    run('INSERT INTO items(lesson_id, seq, label, question, options, correct) VALUES(?, ?, ?, ?, ?, ?)',
      lesson.id, i + 1, it.label, it.question, JSON.stringify(it.options), it.correct);
  });
  return lesson;
}
// With 2 modules in a lesson, each label says which module the item is from.
export function lessonItemsFor(progId, modules) {
  return modules.flatMap(n => lessonItems(progId, n).map(it => (modules.length > 1 ? { ...it, label: `Module ${n} · ${it.label}` } : it)));
}

// The proctor closes items whose time has run out. In the demo group nobody
// teaches, so the proctor opens the next item by itself and starts again at the
// first item when the lesson runs out.
export function tick(lesson) {
  if (!lesson) return;
  const t = now();
  const expired = all("SELECT id FROM items WHERE lesson_id = ? AND state = 'open' AND closes_at IS NOT NULL AND closes_at < ?", lesson.id, t);
  for (const e of expired) run("UPDATE items SET state = 'shown' WHERE id = ?", e.id);
  const g = groupById(lesson.group_id);
  if (g && g.is_demo && lesson.state === 'live') {
    const open = get("SELECT id FROM items WHERE lesson_id = ? AND state = 'open'", lesson.id);
    const lastShown = get("SELECT closes_at FROM items WHERE lesson_id = ? AND state = 'shown' ORDER BY closes_at DESC LIMIT 1", lesson.id);
    const pause = lastShown && lastShown.closes_at && (Date.now() - Date.parse(lastShown.closes_at) < 20000);
    if (!open && !pause) {
      let next = get("SELECT * FROM items WHERE lesson_id = ? AND state = 'ready' ORDER BY seq LIMIT 1", lesson.id);
      if (!next) {
        run('DELETE FROM answers WHERE item_id IN (SELECT id FROM items WHERE lesson_id = ?)', lesson.id);
        run("UPDATE items SET state = 'ready', opened_at = NULL, closes_at = NULL WHERE lesson_id = ?", lesson.id);
        next = get("SELECT * FROM items WHERE lesson_id = ? ORDER BY seq LIMIT 1", lesson.id);
      }
      if (next) {
        openItem(next.id, 120);
        sampleAnswers(next, g.id);
      }
    }
  }
}

// The sample students of the demo group answer as soon as an item opens, so
// that the demo shows a class at work.
function sampleAnswers(item, groupId) {
  const opts = JSON.parse(item.options).map(o => o[0]);
  const t = now();
  for (const s of all("SELECT id FROM users WHERE role = 'sample' AND group_id = ?", groupId)) {
    if (Math.random() > 0.85) continue;
    const choice = item.correct && Math.random() < 0.75 ? item.correct : opts[Math.floor(Math.random() * opts.length)];
    run('INSERT OR IGNORE INTO answers(item_id, user_id, choice, at) VALUES(?, ?, ?, ?)', item.id, s.id, choice, t);
  }
}

export function openItem(itemId, seconds = 120) {
  const it = get('SELECT * FROM items WHERE id = ?', itemId);
  if (!it) return;
  run("UPDATE items SET state = 'closed' WHERE lesson_id = ? AND state = 'open'", it.lesson_id);
  const t = new Date();
  run("UPDATE items SET state = 'open', opened_at = ?, closes_at = ? WHERE id = ?", t.toISOString(), new Date(t.getTime() + seconds * 1000).toISOString(), itemId);
}

export function answerCounts(itemId) {
  const rows = all('SELECT choice, COUNT(*) AS n FROM answers WHERE item_id = ? GROUP BY choice', itemId);
  const m = {}; rows.forEach(r => { m[r.choice] = r.n; });
  return m;
}

// ---------- the live-exercise figures of a group ----------
// For each member and each lesson held: items opened, answered, and correct.
export function groupMatrix(groupId) {
  const lessons = all("SELECT * FROM lessons WHERE group_id = ? AND state != 'planned' ORDER BY number", groupId);
  const items = all(`SELECT i.* FROM items i JOIN lessons l ON l.id = i.lesson_id
                     WHERE l.group_id = ? AND l.state != 'planned' AND i.state != 'ready'`, groupId);
  const answers = all(`SELECT a.* FROM answers a JOIN items i ON i.id = a.item_id JOIN lessons l ON l.id = i.lesson_id
                       WHERE l.group_id = ?`, groupId);
  const itemById = new Map(items.map(i => [i.id, i]));
  const people = members(groupId);
  const L = lessons.map(l => {
    const its = items.filter(i => i.lesson_id === l.id);
    return { ...l, opened: its.length, scored: its.filter(i => i.correct).length };
  });
  const per = new Map(people.map(p => [p.id, L.map(() => ({ answered: 0, correct: 0 }))]));
  for (const a of answers) {
    const it = itemById.get(a.item_id);
    if (!it || !per.has(a.user_id)) continue;
    const li = L.findIndex(l => l.id === it.lesson_id);
    if (li < 0) continue;
    const cell = per.get(a.user_id)[li];
    cell.answered++;
    if (it.correct && a.choice === it.correct) cell.correct++;
  }
  return { lessons: L, people, per };
}

export function personLive(matrix, userId) {
  const cells = matrix.per.get(userId) || [];
  const opened = matrix.lessons.reduce((s, l) => s + l.opened, 0);
  const answered = cells.reduce((s, c) => s + c.answered, 0);
  const scores = matrix.lessons.map((l, i) => (l.scored && cells[i] ? pct(cells[i].correct, l.scored) : null));
  const totalScored = matrix.lessons.reduce((s, l) => s + l.scored, 0);
  const totalCorrect = cells.reduce((s, c) => s + c.correct, 0);
  return { cells, opened, answered, eng: pct(answered, opened), scores, score: pct(totalCorrect, totalScored) };
}

export function groupLessonAverages(matrix) {
  return matrix.lessons.map((l, i) => {
    const vals = matrix.people.map(p => {
      const c = matrix.per.get(p.id)[i];
      return c.answered && l.scored ? pct(c.correct, l.scored) : null;
    });
    const answered = matrix.people.map(p => matrix.per.get(p.id)[i].answered);
    const active = matrix.people.length;
    return {
      score: avg(vals) == null ? null : Math.round(avg(vals)),
      answeredRate: l.opened && active ? Math.round((answered.reduce((s, x) => s + x, 0) / (l.opened * active)) * 100) : null,
      avgAnswered: active ? answered.reduce((s, x) => s + x, 0) / active : 0,
    };
  });
}

// ---------- practice and modules ----------
export function practiceOf(userId, progId) {
  const rows = all('SELECT * FROM practice WHERE user_id = ?', userId);
  const out = {};
  for (const n of modulesWithContent(progId)) {
    const mc = moduleContent(progId, n);
    const ex = mc.practice || [];
    const mine = rows.filter(r => r.module === n);
    const choice = ex.filter(e => e.kind === 'choice');
    const answeredChoice = mine.filter(r => choice.some(c => c.id === r.exercise));
    const correct = answeredChoice.filter(r => r.correct === 1).length;
    out[n] = {
      total: ex.length,
      done: mine.length,
      studied: ex.length > 0 && mine.length >= ex.length,
      accuracy: answeredChoice.length ? pct(correct, answeredChoice.length) : null,
      answers: Object.fromEntries(mine.map(r => [r.exercise, r])),
    };
  }
  return out;
}

export function savePractice(userId, progId, n, exerciseId, answer) {
  const mc = moduleContent(progId, n);
  const ex = mc && mc.practice.find(e => e.id === exerciseId);
  if (!ex) return null;
  let correct = null;
  if (ex.kind === 'choice') {
    if (!ex.options.some(o => o[0] === answer)) return null;
    correct = answer === ex.correct ? 1 : 0;
  } else {
    answer = String(answer || '').slice(0, 4000);
  }
  run(`INSERT INTO practice(user_id, module, exercise, answer, correct, at) VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, module, exercise) DO UPDATE SET answer = excluded.answer, correct = excluded.correct, at = excluded.at`,
    userId, n, exerciseId, answer, correct, now());
  return correct;
}

export function partAccuracy(prac, progId) {
  const parts = {};
  for (const [n, s] of Object.entries(prac)) {
    const p = partOf(progId, Number(n));
    if (!p || s.accuracy == null) continue;
    (parts[p.n] = parts[p.n] || []).push(s.accuracy);
  }
  return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(avg(v))]));
}

// ---------- projects ----------
export function projectsOf(userId) {
  const out = {};
  for (const kind of ['own', 'tribunal']) {
    const p = get('SELECT * FROM projects WHERE user_id = ? AND kind = ?', userId, kind);
    const checks = p ? all('SELECT * FROM checks WHERE project_id = ? ORDER BY at DESC', p.id) : [];
    out[kind] = { project: p || null, last: checks[0] || null, history: checks.slice(1, 6) };
  }
  return out;
}
export function projectState(pr) {
  if (!pr.project) return 'none';
  if (!pr.last) return 'submitted';
  if (pr.last.failed) return 'failed';
  if (pr.last.warnings) return 'warning';
  return 'passed';
}

// ---------- readiness for the exam (draft conditions, specification 4.6) ----------
export function readiness(user, ctx) {
  const g = groupById(user.group_id);
  const prog = g.programme;
  const taughtModules = [...new Set(all("SELECT module FROM lessons WHERE group_id = ? AND state = 'ended'", g.id).map(r => r.module))];
  const withPage = taughtModules.filter(n => moduleContent(prog, n));
  const prac = ctx.prac || practiceOf(user.id, prog);
  const studied = withPage.filter(n => prac[n] && prac[n].studied).length;
  const live = ctx.live;
  const parts = partAccuracy(prac, prog);
  const partVals = Object.values(parts);
  const projs = ctx.projects || projectsOf(user.id);
  const own = projectState(projs.own), trib = projectState(projs.tribunal);
  const conds = [
    { title: 'Study the modules taught so far', state: !withPage.length ? 'none' : studied === withPage.length ? 'ok' : 'warn', text: withPage.length ? `${studied} of ${withPage.length} studied` : 'no study pages for the modules taught yet' },
    { title: 'Answer at least 80% of live exercises', state: live.eng == null ? 'none' : live.eng >= 80 ? 'ok' : 'bad', text: live.eng == null ? 'no lessons held yet' : `${live.eng}% answered` },
    { title: 'Reach 70% in practice for each part', state: !partVals.length ? 'none' : partVals.every(v => v >= 70) ? 'ok' : 'warn', text: partVals.length ? Object.entries(parts).map(([k, v]) => `part ${k}: ${v}%`).join(', ') : 'no practice yet' },
    { title: 'Own project passes every check', state: own === 'passed' ? 'ok' : own === 'none' ? 'none' : 'bad', text: { passed: 'every check passed', none: 'not submitted', submitted: 'not checked yet', failed: `${projs.own.last ? projs.own.last.failed : 0} check failed`, warning: `${projs.own.last ? projs.own.last.warnings : 0} warning` }[own] },
    { title: 'Tribunal submitted and passes every check', state: trib === 'passed' ? 'ok' : trib === 'none' ? 'none' : 'bad', text: { passed: 'every check passed', none: 'not submitted', submitted: 'not checked yet', failed: `${projs.tribunal.last ? projs.tribunal.last.failed : 0} check failed`, warning: `${projs.tribunal.last ? projs.tribunal.last.warnings : 0} warning` }[trib] },
    { title: 'Take at least 1 practice exam', state: 'none', text: 'practice exams open later' },
  ];
  return { conds, met: conds.filter(c => c.state === 'ok').length };
}

// ---------- ratings ----------
export function ratingsByLesson(groupId) {
  return all(`SELECT l.id, l.number, l.module, l.modules, COUNT(r.id) AS n, AVG(r.rating) AS avg
              FROM lessons l LEFT JOIN lesson_ratings r ON r.lesson_id = l.id
              WHERE l.group_id = ? AND l.state = 'ended' GROUP BY l.id ORDER BY l.number`, groupId);
}
export function myLessonRating(userId, lessonId) {
  return get('SELECT * FROM lesson_ratings WHERE lesson_id = ? AND voter = ?', lessonId, voterKey(userId, `lesson:${lessonId}`));
}
// The lesson a student can rate now: the latest lesson ended in the last 7 days.
export function lessonToRate(user) {
  const l = lastEnded(user.group_id);
  if (!l) return null;
  return { lesson: l, mine: myLessonRating(user.id, l.id) };
}
export function saveLessonRating(user, lessonId, rating, helped, blocked, comment) {
  const l = get('SELECT * FROM lessons WHERE id = ? AND group_id = ?', lessonId, user.group_id);
  if (!l || l.state !== 'ended') return false;
  const r = Number(rating);
  if (!(r >= 1 && r <= 5)) return false;
  run(`INSERT INTO lesson_ratings(lesson_id, voter, rating, helped, blocked, comment, at) VALUES(?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(lesson_id, voter) DO UPDATE SET rating = excluded.rating, helped = excluded.helped, blocked = excluded.blocked, comment = excluded.comment, at = excluded.at`,
    lessonId, voterKey(user.id, `lesson:${lessonId}`), r, JSON.stringify(helped || []), JSON.stringify(blocked || []), (comment || '').slice(0, 1000) || null, now());
  return true;
}
export function saveModuleRating(user, n, clarity) {
  const c = Number(clarity);
  if (!(c >= 1 && c <= 5)) return false;
  run(`INSERT INTO module_ratings(group_id, module, voter, clarity, at) VALUES(?, ?, ?, ?, ?)
       ON CONFLICT(group_id, module, voter) DO UPDATE SET clarity = excluded.clarity, at = excluded.at`,
    user.group_id, n, voterKey(user.id, `module:${n}`), c, now());
  return true;
}
export function myModuleRating(user, n) {
  return get('SELECT clarity FROM module_ratings WHERE group_id = ? AND module = ? AND voter = ?', user.group_id, n, voterKey(user.id, `module:${n}`));
}
export const openSurvey = groupId => get("SELECT * FROM surveys WHERE group_id = ? AND state = 'open' ORDER BY id DESC LIMIT 1", groupId);
export function mySurveyAnswer(user, surveyId) {
  return get('SELECT id FROM survey_answers WHERE survey_id = ? AND voter = ?', surveyId, voterKey(user.id, `survey:${surveyId}`));
}
export const DIMENSIONS = [
  ['clarity', 'Clarity'], ['pace', 'Pace'], ['usefulness', 'Usefulness for work'],
  ['interest', 'Interest'], ['support', 'Support from agents'], ['workload', 'Manageable workload'],
];
export function saveSurvey(user, surveyId, f) {
  const s = get("SELECT * FROM surveys WHERE id = ? AND group_id = ? AND state = 'open'", surveyId, user.group_id);
  if (!s) return false;
  const v = k => { const x = Number(f[k]); return x >= 1 && x <= 5 ? x : null; };
  const rec = Number(f.recommend); const recommend = rec >= 0 && rec <= 10 && f.recommend !== '' ? rec : null;
  run(`INSERT INTO survey_answers(survey_id, voter, overall, clarity, pace, usefulness, interest, support, workload, recommend, at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(survey_id, voter) DO NOTHING`,
    surveyId, voterKey(user.id, `survey:${surveyId}`), v('overall'), v('clarity'), v('pace'), v('usefulness'), v('interest'), v('support'), v('workload'), recommend, now());
  return true;
}

function pearson(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(p => p[0] != null && p[1] != null);
  if (pairs.length < 3) return null;
  const mx = avg(pairs.map(p => p[0])), my = avg(pairs.map(p => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

// The teacher's satisfaction report. Every figure that comes from ratings is
// shown only when it rests on 5 or more answers.
export function satisfaction(groupId) {
  const size = members(groupId).length;
  const lessons = ratingsByLesson(groupId).map(r => ({ ...r, shown: r.n >= MIN_GROUP, avg: r.n >= MIN_GROUP ? r.avg : null, rate: size ? Math.round((r.n / size) * 100) : null }));
  const shown = lessons.filter(l => l.shown);
  const avgRating = shown.length ? avg(shown.map(l => l.avg)) : null;
  const half = Math.ceil(shown.length / 2);
  const first = shown.length >= 2 ? avg(shown.slice(0, half).map(l => l.avg)) : null;
  const last = shown.length >= 2 ? avg(shown.slice(half).map(l => l.avg)) : null;
  const totalRatings = lessons.reduce((s, l) => s + l.n, 0);
  const possible = lessons.length * size;

  const all_ = all(`SELECT r.helped, r.blocked, r.comment, l.number FROM lesson_ratings r JOIN lessons l ON l.id = r.lesson_id WHERE l.group_id = ?`, groupId);
  const tally = key => { const m = {}; all_.forEach(r => JSON.parse(r[key] || '[]').forEach(t => { m[t] = (m[t] || 0) + 1; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const comments = all_.filter(r => r.comment).map(r => ({ text: r.comment, lesson: r.number }));

  const surveys = all('SELECT * FROM surveys WHERE group_id = ? ORDER BY id', groupId).map(s => {
    const ans = all('SELECT * FROM survey_answers WHERE survey_id = ?', s.id);
    return { ...s, n: ans.length, ans };
  });
  const latest = [...surveys].reverse().find(s => s.n >= MIN_GROUP) || null;
  const earlier = latest ? [...surveys].reverse().find(s => s.id < latest.id && s.n >= MIN_GROUP) || null : null;
  let dims = null, recommend = null;
  if (latest) {
    dims = DIMENSIONS.map(([k, label]) => {
      const vals = latest.ans.map(a => a[k]);
      return {
        key: k, label,
        v: avg(vals),
        prev: earlier ? avg(earlier.ans.map(a => a[k])) : null,
        imp: pearson(vals, latest.ans.map(a => a.overall)),
      };
    });
    const recs = latest.ans.map(a => a.recommend).filter(x => x != null);
    if (recs.length >= MIN_GROUP) {
      const dist = Array.from({ length: 11 }, (_, i) => recs.filter(x => x === i).length);
      const prom = recs.filter(x => x >= 9).length, det = recs.filter(x => x <= 6).length;
      recommend = { n: recs.length, dist, score: Math.round(((prom - det) / recs.length) * 100), prom: pct(prom, recs.length), det: pct(det, recs.length) };
    }
  }
  const modules = all(`SELECT module, COUNT(*) AS n, AVG(clarity) AS avg FROM module_ratings WHERE group_id = ? GROUP BY module ORDER BY module`, groupId)
    .map(m => ({ ...m, avg: m.n >= MIN_GROUP ? m.avg : null }));
  return {
    size, lessons, avgRating, first, last, totalRatings,
    responseRate: possible ? Math.round((totalRatings / possible) * 100) : null,
    index: avgRating == null ? null : Math.round(((avgRating - 1) / 4) * 100),
    helped: totalRatings >= MIN_GROUP ? tally('helped') : [],
    blocked: totalRatings >= MIN_GROUP ? tally('blocked') : [],
    comments: comments.length >= MIN_GROUP ? comments : [],
    commentCount: comments.length,
    surveys, latest, earlier, dims, recommend, modules,
  };
}

// ---------- flags from the analyst ----------
// The trend compares the share of exercises answered in the first 3 and the
// last 3 lessons that have ended. A running lesson is left out, because its
// exercises are not all open yet.
export function trendOf(live, lessons) {
  const r = live.cells.map((c, i) => (lessons[i] && lessons[i].state === 'ended' && lessons[i].opened ? c.answered / lessons[i].opened : null)).filter(v => v != null);
  if (r.length < 6) return 'flat';
  const a = avg(r.slice(0, 3)), b = avg(r.slice(-3));
  return b - a > 0.2 ? 'up' : a - b > 0.2 ? 'down' : 'flat';
}

export function flagFor(person, live, prac, projs, lessons) {
  const held = lessons.filter(l => l.state === 'ended').length;
  if (held >= 2 && live.eng != null && live.eng < 60) return 'Answers fewer than 60% of live exercises';
  if (trendOf(live, lessons) === 'down' && projectState(projs.own) !== 'passed') return 'Engagement falling and individual project not passing';
  const studied = Object.values(prac).filter(p => p.studied).length;
  if (held >= 6 && projectState(projs.own) === 'none' && studied === 0) return 'No project submitted and no module studied';
  return '';
}

// One row per member for the teacher's class progress page.
export function classRows(groupId) {
  const g = groupById(groupId);
  const m = groupMatrix(groupId);
  const held = m.lessons.filter(l => l.state === 'ended').length;
  const rows = m.people.map(p => {
    const live = personLive(m, p.id);
    const prac = practiceOf(p.id, g.programme);
    const projs = projectsOf(p.id);
    const ready = readiness(p, { live, prac, projects: projs });
    const studied = Object.values(prac).filter(x => x.studied).length;
    return {
      user: p, live, prac, projs, ready, studied,
      practice: avg(Object.values(prac).map(x => x.accuracy)),
      own: projectState(projs.own), trib: projectState(projs.tribunal),
      trend: trendOf(live, m.lessons),
      flag: flagFor(p, live, prac, projs, m.lessons),
    };
  });
  const notRegistered = all(`SELECT p.email, p.first_name, p.last_name FROM permitted p LEFT JOIN users u ON u.email = p.email WHERE p.group_id = ? AND u.id IS NULL ORDER BY p.email`, groupId);
  return { group: g, matrix: m, rows, notRegistered, held };
}
