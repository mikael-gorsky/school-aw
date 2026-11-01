// The demo group: a sample class in which the demo login is one of the students.
// Everything in it is deleted and built again every night, so whatever anyone
// enters under the demo login is gone the next day (decision of 31 October 2026).
// The sample data is made from a fixed seed, so the demo looks the same each day.
import { all, get, run, now, tx, voterKey, setting, setSetting, log } from './db.js';
import { programme, lessonItems, moduleContent, modulesWithContent } from './content.js';
import { DIMENSIONS } from './model.js';
import { israelDay, israelToIso } from './schedule.js';

const DEMO = { institution: 'SAW demo', code: 'demo', programme: 'ase' };
const SAMPLES = 33;
const DEMO_LESSONS = [[1], [2, 3], [4, 6], [5, 7], [8, 9], [10], [11], [12, 13], [14, 15], [16, 17], [18, 19]].map((modules, i) => ({ n: i + 1, modules }));
const HELPED = ['Live exercises', 'Examples', 'Slides', 'Pace', 'Questions and answers'];
const BLOCKED = ['Too fast', 'Too slow', 'Unclear slides', 'Sound or video', 'Too much at once'];
const COMMENTS = [
  'The live exercises kept me awake and showed me what I had missed.',
  'Too much material in the last block. I could not follow the pace.',
  'The examples from real projects helped most.',
  'Please share the slides before the lesson.',
  'Good lesson, but the sound on Zoom dropped twice.',
  'I liked that we discussed the wrong answers, not only the right one.',
  'The pace was too fast after the break.',
  'The part about verifying the agent was the most useful so far.',
  'More time for questions at the end, please.',
  'Clear explanation of the context file.',
  'Too many new terms in one lesson.',
  'The warm-up quiz is a good way to start.',
];

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function demoGroup() {
  return get('SELECT * FROM groups WHERE is_demo = 1 LIMIT 1');
}

// Generic items for lessons whose module has no exercises in the content yet.
function itemsForLesson(modules) {
  return modules.flatMap(n => itemsFor(n).map(it => (modules.length > 1 ? { ...it, label: `Module ${n} · ${it.label}` } : it)));
}
function itemsFor(moduleNo) {
  const real = lessonItems(DEMO.programme, moduleNo);
  if (real.length) return real;
  const opts = [['a', 'The answer the lesson gave.'], ['b', 'A common mistake.'], ['c', 'A second common mistake.'], ['d', 'An answer outside the lesson.']];
  return [
    { label: 'Warm-up quiz', question: `Sample warm-up question on module ${moduleNo - 1}.`, options: opts, correct: 'a' },
    ...[1, 2, 3, 4].map(b => ({ label: `After block ${b}`, question: `Sample question after block ${b} of module ${moduleNo}.`, options: opts, correct: 'a' })),
  ];
}

function clear() {
  const g = demoGroup();
  run("DELETE FROM users WHERE role = 'sample'");
  const demo = get("SELECT id FROM users WHERE role = 'demo'");
  if (demo) {
    run('DELETE FROM tutor_usage WHERE user_id = ?', demo.id);
    run('DELETE FROM users WHERE id = ?', demo.id);
  }
  if (g) {
    run('DELETE FROM permitted WHERE group_id = ?', g.id);
    run('DELETE FROM groups WHERE id = ?', g.id);
  }
}

// Made-up names for the demo login and the sample students, so that the demo
// shows My account and the teacher's lists as they look with real students.
const FIRST = ['Noa', 'Daniel', 'Maya', 'Yonatan', 'Tamar', 'Omer', 'Shira', 'Ariel', 'Yael', 'Itai', 'Michal', 'Eitan', 'Roni', 'Amit', 'Lior', 'Hila', 'Gal', 'Nadav', 'Dana', 'Tomer', 'Adi', 'Ido', 'Neta', 'Alon', 'Rotem', 'Yuval', 'Inbar', 'Guy', 'Sapir', 'Oren', 'Liat', 'Ran', 'Efrat', 'Avi'];
const LAST = ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton', 'Friedman', 'Azulay', 'Katz', 'Shapiro', 'Dahan', 'Avraham', 'Golan', 'Ben-David', 'Klein', 'Rosen', 'Halevi', 'Amar', 'Barak', 'Segal', 'Weiss', 'Ohana', 'Gabay', 'Malka', 'Navon', 'Sasson', 'Tal', 'Harel', 'Stern', 'Carmi', 'Erez', 'Mor', 'Paz', 'Shalom', 'Yosef'];

function build() {
  const r = rng(20261031);
  const pick = a => a[Math.floor(r() * a.length)];
  const t0 = now();
  run('INSERT INTO groups(institution, code, programme, is_demo, created_at) VALUES(?, ?, ?, 1, ?)', DEMO.institution, DEMO.code, DEMO.programme, t0);
  const g = demoGroup();
  run("INSERT INTO users(email, role, group_id, registered_at, first_name, last_name) VALUES('demo', 'demo', ?, ?, ?, ?)", g.id, t0, FIRST[0], LAST[0]);
  const demo = get("SELECT * FROM users WHERE role = 'demo'");

  // Each sample student has a steady habit of answering and a level of accuracy.
  // A few lose interest over the course, which the analyst then flags.
  const people = [{ id: demo.id, p: 0.96, q: 0.78, fade: 0 }];
  for (let i = 1; i <= SAMPLES; i++) {
    const email = `student${String(i).padStart(2, '0')}@example.org`;
    run("INSERT INTO users(email, role, group_id, registered_at, last_seen, first_name, last_name) VALUES(?, 'sample', ?, ?, ?, ?, ?)", email, g.id, t0, t0, FIRST[i], LAST[i]);
    const u = get('SELECT id FROM users WHERE email = ?', email);
    people.push({ id: u.id, p: 0.62 + r() * 0.38, q: 0.5 + r() * 0.45, fade: i % 9 === 0 ? 0.12 : 0 });
  }

  // The demo groups its modules into 11 lessons, as a teacher might in a
  // semester. The first 5 are over, lesson 6 is running, and the rest are planned.
  const prog = programme(DEMO.programme);
  const plan = DEMO_LESSONS.filter(l => l.modules.every(n => prog.modules.some(m => m.n === n)));
  const LIVE = Math.ceil(plan.length / 2);
  const nowMs = Date.now();
  const lessons = [];
  for (const pl of plan) {
    const starts = new Date(nowMs + (pl.n - LIVE) * 7 * 864e5 - 30 * 60000);
    starts.setUTCMinutes(0, 0, 0);
    const state = pl.n < LIVE ? 'ended' : pl.n === LIVE ? 'live' : 'planned';
    // The calendar shows each lesson on its day at 10:00–13:00 Israel time, like
    // a real class; the exercises keep their times around the reset, so that
    // the demo lesson runs at any hour (decision of 1 November 2026).
    const day = israelDay(starts);
    run('INSERT INTO lessons(group_id, number, module, modules, starts_at, ends_at, state) VALUES(?, ?, ?, ?, ?, ?, ?)', g.id, pl.n, pl.modules[0], JSON.stringify(pl.modules), israelToIso(day, '10:00'), israelToIso(day, '13:00'), state);
    const l = get('SELECT * FROM lessons WHERE group_id = ? AND number = ?', g.id, pl.n);
    l.modules_list = pl.modules;
    itemsForLesson(pl.modules).forEach((it, i) => {
      const done = state === 'ended' || (state === 'live' && i < 2);
      const at = new Date(starts.getTime() + (i * 15 + 5) * 60000).toISOString();
      const closes = state === 'live' ? new Date(nowMs - (2 - i) * 300000).toISOString() : new Date(Date.parse(at) + 120000).toISOString();
      run('INSERT INTO items(lesson_id, seq, label, question, options, correct, state, opened_at, closes_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
        l.id, i + 1, it.label, it.question, JSON.stringify(it.options), it.correct, done ? 'shown' : 'ready', done ? at : null, done ? closes : null);
    });
    lessons.push(l);
  }

  // Answers to the live exercises.
  for (const l of lessons.filter(x => x.state !== 'planned')) {
    const items = all("SELECT * FROM items WHERE lesson_id = ? AND state != 'ready'", l.id);
    for (const it of items) {
      const opts = JSON.parse(it.options);
      for (const p of people) {
        const prob = Math.max(0.15, p.p - p.fade * (l.number - 1));
        if (r() > prob) continue;
        const right = it.correct && r() < p.q;
        const choice = right ? it.correct : pick(opts.filter(o => o[0] !== it.correct))[0];
        run('INSERT INTO answers(item_id, user_id, choice, at) VALUES(?, ?, ?, ?)', it.id, p.id, choice, it.opened_at);
      }
    }
  }

  // Lesson ratings. The demo login has rated every lesson that is over except
  // the last one, so that the rating form is there to try.
  const means = [4.4, 4.2, 4.3, 4.1, 3.9, 3.6, 4.0, 4.3];
  let c = 0;
  for (const l of lessons.filter(x => x.state === 'ended')) {
    for (const p of people) {
      if (p.id === demo.id ? l.number === LIVE - 1 : r() > 0.62 + r() * 0.3) continue;
      const rating = Math.max(1, Math.min(5, Math.round(means[l.number - 1] + (r() - 0.5) * 1.8)));
      const helped = HELPED.filter(() => r() < 0.3);
      const blocked = BLOCKED.filter((b, i) => r() < (l.number === 6 && i === 0 ? 0.55 : 0.12));
      const comment = p.id !== demo.id && r() < 0.18 ? COMMENTS[c++ % COMMENTS.length] : null;
      run('INSERT INTO lesson_ratings(lesson_id, voter, rating, helped, blocked, comment, at) VALUES(?, ?, ?, ?, ?, ?, ?)',
        l.id, voterKey(p.id, `lesson:${l.id}`), rating, JSON.stringify(helped), JSON.stringify(blocked), comment, l.starts_at);
    }
  }

  // Two surveys, both closed. Pace and workload are the weakest dimensions and
  // move the overall rating most, as in the agreed mockup.
  const base = { clarity: 4.2, pace: 3.5, usefulness: 4.4, interest: 4.3, support: 3.6, workload: 3.6 };
  [['First survey', 7, 27, 0.15], ['Mid-course survey', 3, 29, 0]].forEach(([label, weeks, n, shift]) => {
    run("INSERT INTO surveys(group_id, label, state, opened_at) VALUES(?, ?, 'closed', ?)", g.id, label, new Date(nowMs - weeks * 7 * 864e5).toISOString());
    const s = get('SELECT id FROM surveys WHERE group_id = ? AND label = ?', g.id, label);
    people.slice(1, n + 1).forEach(p => {
      const mood = (r() - 0.5) * 1.6;
      const v = {};
      for (const [k] of DIMENSIONS) {
        const w = k === 'pace' || k === 'workload' ? 1 : 0.35;
        const adj = k === 'support' ? -shift * 2 : k === 'pace' ? shift * 2 : 0;
        v[k] = Math.max(1, Math.min(5, Math.round(base[k] + adj + mood * w + (r() - 0.5))));
      }
      const overall = Math.max(1, Math.min(5, Math.round((v.pace + v.workload) / 2 * 0.6 + 4.2 * 0.4 + (r() - 0.5) * 0.6)));
      const recommend = Math.max(0, Math.min(10, Math.round(overall * 2 + 0.8 + (r() - 0.5) * 3)));
      run('INSERT INTO survey_answers(survey_id, voter, overall, clarity, pace, usefulness, interest, support, workload, recommend, at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        s.id, voterKey(p.id, `survey:${s.id}`), overall, v.clarity, v.pace, v.usefulness, v.interest, v.support, v.workload, recommend, t0);
    });
  });

  // Practice on the study pages of the modules taught so far, and clarity ratings for them.
  const taught = new Set(lessons.filter(l => l.state === 'ended').flatMap(l => l.modules_list));
  for (const n of modulesWithContent(DEMO.programme).filter(m => taught.has(m))) {
    const mc = moduleContent(DEMO.programme, n);
    for (const p of people) {
      if (p.id !== demo.id && r() > 0.8) continue;
      for (const e of mc.practice) {
        if (p.id !== demo.id && r() > 0.9) continue;
        let answer, correct = null;
        if (e.kind === 'choice') { const ok = r() < p.q + 0.1; answer = ok ? e.correct : pick(e.options.filter(o => o[0] !== e.correct))[0]; correct = ok ? 1 : 0; }
        else answer = 'Agents write code faster than I can check it, so speed alone gives code that nobody can trust.';
        run('INSERT INTO practice(user_id, module, exercise, answer, correct, at) VALUES(?, ?, ?, ?, ?, ?)', p.id, n, e.id, answer, correct, t0);
      }
      if (p.id !== demo.id && r() < 0.8) {
        run('INSERT INTO module_ratings(group_id, module, voter, clarity, at) VALUES(?, ?, ?, ?, ?)', g.id, n, voterKey(p.id, `module:${n}`), Math.max(1, Math.min(5, Math.round(4.1 + (r() - 0.5) * 2))), t0);
      }
    }
  }

  // Projects with sample checks. The site never calls GitHub for these.
  const CHECKS = [
    ['public', 'The repository is public.'], ['context', 'A context file, CLAUDE.md, is in the root folder.'],
    ['spread', 'The work is spread over time.'], ['messages', 'Commit messages say what changed.'],
    ['tests', 'Tests exist.'], ['record', 'A record of the work with the agent is kept in the repository.'],
    ['readme', 'The README explains how to run the project.'],
  ];
  const fails = { tests: 0.4, messages: 0.28, readme: 0.15, context: 0.12, record: 0.2, public: 0.05, spread: 0.1 };
  const addProject = (uid, kind, name, forced) => {
    run('INSERT INTO projects(user_id, kind, repo, submitted_at) VALUES(?, ?, ?, ?)', uid, kind, `https://github.com/saw-demo/${name}`, t0);
    const pr = get('SELECT id FROM projects WHERE user_id = ? AND kind = ?', uid, kind);
    const results = CHECKS.map(([key, title]) => {
      let state = forced ? forced[key] || 'ok' : r() < fails[key] ? (key === 'messages' || key === 'record' ? 'warn' : 'bad') : 'ok';
      return { key, title, state, detail: state === 'ok' ? '' : key === 'tests' ? 'No test files or test folder were found.' : key === 'messages' ? '6 of 23 messages are a single word, such as "fix" or "update".' : key === 'readme' ? 'The README does not say how to install or run the project.' : '' };
    });
    const passed = results.filter(x => x.state === 'ok').length, warnings = results.filter(x => x.state === 'warn').length, failed = results.filter(x => x.state === 'bad').length;
    const fb = failed || warnings ? 'Your repository is public and the context file is in place. Fix the failed checks and run the check again.' : 'Every check passed. Keep working along the course schedule.';
    run('INSERT INTO checks(project_id, at, results, passed, warnings, failed, feedback) VALUES(?, ?, ?, ?, ?, ?, ?)', pr.id, t0, JSON.stringify(results), passed, warnings, failed, fb);
  };
  addProject(demo.id, 'own', 'demo-own', { messages: 'warn', tests: 'bad' });
  people.slice(1).forEach((p, i) => {
    if (r() < 0.62) addProject(p.id, 'own', `student${String(i + 1).padStart(2, '0')}-own`);
    if (r() < 0.25) addProject(p.id, 'tribunal', `student${String(i + 1).padStart(2, '0')}-tribunal`);
  });
}

export function resetDemo() {
  tx(() => { clear(); build(); });
  const t = israelNow();
  if (t.hour >= 3) setSetting('demo_reset_day', t.day);
}

export function ensureDemo() {
  if (!demoGroup()) resetDemo();
}

// Israel date and hour, for the nightly reset at 03:00.
function israelNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

// Runs once a minute. A pod that was suspended at 03:00 resets on its first
// minute after waking.
export function nightlyCheck() {
  const t = israelNow();
  if (t.hour >= 3 && setting('demo_reset_day', '') !== t.day) {
    resetDemo();
    log('steward', 'reset the demo group for the night');
  }
}
