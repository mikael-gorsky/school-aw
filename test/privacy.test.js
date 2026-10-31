// The privacy rules: no ID number is ever stored, ratings are anonymous and
// shown to the teacher only from 5 or more students, and the tutor's questions
// reach the AI service without a name or an address (CLAUDE.md, rules of the
// product; decisions of 27 and 29 October 2026).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, stop, db, realFetch } from './helpers.js';
import { readPermitCsv } from '../server/csv.js';
import * as M from '../server/model.js';

after(stop);

const ID = '318765432';
const MOODLE = `First name,Last name,ID number,Email address,Groups\r\nDana,Levi,${ID},dana.levi@gmail.com,62121-31\r\n"Cohen, Avi",Cohen,${ID.replace('3', '2')},avi@gmail.com,"62121-32, ASE all"\r\n`;

const teacher = await signInDev('teacher@example.com');

function everyStoredText() {
  const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(t => t.name);
  return tables.flatMap(t => db.all(`SELECT * FROM "${t}"`).flatMap(row => Object.values(row).map(String)));
}

test('the CSV reader keeps only the email and the group of each row', () => {
  const rows = readPermitCsv(MOODLE);
  assert.deepEqual(rows, [
    { email: 'dana.levi@gmail.com', group: '62121-31' },
    { email: 'avi@gmail.com', group: '62121-32' },
  ]);
  for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['email', 'group']);
});

test('the CSV reader accepts semicolons and a file without a header', () => {
  assert.deepEqual(readPermitCsv('Email;Group\nA@Gmail.com;7'), [{ email: 'a@gmail.com', group: '7' }]);
  assert.deepEqual(readPermitCsv(`${ID},b@gmail.com\n`), [{ email: 'b@gmail.com', group: '' }]);
});

test('a Moodle export sent to the server leaves no ID number in the database', async () => {
  const r = await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { csv: MOODLE, emails: '', institution: 'Holon Institute of Technology', code: '62121-31', programme: 'ase' } });
  assert.equal(r.status, 303);
  assert.ok(db.get('SELECT * FROM permitted WHERE email = ?', 'dana.levi@gmail.com'));
  const text = everyStoredText().join('\n');
  assert.ok(!text.includes(ID));
  assert.ok(!text.includes('Levi,'));
});

test('no table has a column for an ID number', () => {
  const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table'").map(t => t.name);
  for (const t of tables) {
    for (const c of db.all(`PRAGMA table_info("${t}")`)) assert.doesNotMatch(c.name, /id_?num|idnum|identity|teudat|passport|national/i, `${t}.${c.name}`);
  }
});

test('ratings are stored without the user id', () => {
  for (const t of ['lesson_ratings', 'module_ratings', 'survey_answers', 'tutor_passed']) {
    const cols = db.all(`PRAGMA table_info("${t}")`).map(c => c.name);
    assert.ok(!cols.includes('user_id'), t);
    assert.ok(!cols.includes('email'), t);
  }
});

// A small group with its own ended lesson, to count ratings exactly.
async function smallGroup(code, n) {
  const emails = Array.from({ length: n }, (_, i) => `r${code}-${i}@gmail.com`);
  await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: emails.join('\n'), institution: 'Test', code, programme: 'ase' } });
  const g = db.get('SELECT * FROM groups WHERE code = ?', code);
  db.run("INSERT INTO lessons(group_id, number, module, state) VALUES(?, 1, 1, 'ended')", g.id);
  const lesson = db.get('SELECT * FROM lessons WHERE group_id = ?', g.id);
  const jars = [];
  for (const e of emails) jars.push((await signInDev(e)).jar);
  return { g, lesson, jars };
}

test('the teacher sees no lesson rating from fewer than 5 students', async () => {
  const { g, lesson, jars } = await smallGroup('t4', 4);
  for (const jar of jars) await req('POST', '/class/rate', { jar, form: { lesson: lesson.id, rating: '1', comment: 'Rating comment four.' } });
  assert.equal(db.get('SELECT COUNT(*) AS n FROM lesson_ratings WHERE lesson_id = ?', lesson.id).n, 4);
  const s = M.satisfaction(g.id);
  assert.equal(s.lessons[0].shown, false);
  assert.equal(s.lessons[0].avg, null);
  assert.equal(s.avgRating, null);
  assert.deepEqual(s.comments, []);
  const page = await req('GET', `/teacher/satisfaction?group=${g.id}`, { jar: teacher.jar });
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, /Rating comment four/);
  assert.doesNotMatch(page.text, /1\.0<small> of 5/);
});

test('the teacher sees the average once 5 students have rated', async () => {
  const { g, lesson, jars } = await smallGroup('t5', 5);
  for (const jar of jars) await req('POST', '/class/rate', { jar, form: { lesson: lesson.id, rating: '4', comment: 'Rating comment five.' } });
  const s = M.satisfaction(g.id);
  assert.equal(s.lessons[0].shown, true);
  assert.equal(s.lessons[0].avg, 4);
  const page = await req('GET', `/teacher/satisfaction?group=${g.id}`, { jar: teacher.jar });
  assert.match(page.text, /4\.0<small> of 5/);
  assert.match(page.text, /Rating comment five/);
});

test('a student can rate a lesson only once, and changing the rating replaces it', async () => {
  const { lesson, jars } = await smallGroup('t1', 1);
  await req('POST', '/class/rate', { jar: jars[0], form: { lesson: lesson.id, rating: '2' } });
  await req('POST', '/class/rate', { jar: jars[0], form: { lesson: lesson.id, rating: '5' } });
  const rows = db.all('SELECT rating FROM lesson_ratings WHERE lesson_id = ?', lesson.id);
  assert.deepEqual(rows.map(r => r.rating), [5]);
});

test('module clarity and survey figures stay hidden below 5 answers', async () => {
  const { g, jars } = await smallGroup('m4', 4);
  for (const jar of jars) await req('POST', '/study/1/rate', { jar, form: { clarity: '2' } });
  assert.equal(M.satisfaction(g.id).modules[0].avg, null);
  db.run("INSERT INTO surveys(group_id, label, state, opened_at) VALUES(?, 'First survey', 'open', '2026-10-01')", g.id);
  const sv = db.get('SELECT id FROM surveys WHERE group_id = ?', g.id);
  const answers = { survey: sv.id, overall: '3', clarity: '3', pace: '3', usefulness: '3', interest: '3', support: '3', workload: '3', recommend: '9' };
  for (const jar of jars) await req('POST', '/survey', { jar, form: answers });
  const s = M.satisfaction(g.id);
  assert.equal(s.latest, null);
  assert.equal(s.dims, null);
  assert.equal(s.recommend, null);
});

test('a question to the tutor reaches the AI service without the name or address', async () => {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://api.anthropic.com')) {
      sent.push(opts.body);
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Only public repositories are graded.\nSource: Projects' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  try {
    const email = 'curious.student@gmail.com';
    await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: email, institution: 'Test', code: 'tutor', programme: 'ase' } });
    const { jar } = await signInDev(email);
    const r = await req('POST', '/api/tutor', { jar, json: { question: 'Does my repository have to be public?' } });
    assert.equal(r.status, 200);
    assert.equal(r.json().answer, 'Only public repositories are graded.');
    assert.equal(sent.length, 1);
    assert.ok(!sent[0].includes(email));
    assert.ok(!sent[0].includes('curious'));
  } finally {
    globalThis.fetch = original;
  }
});

test('a question the tutor passes on is stored without the asker', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => (String(url).startsWith('https://api.anthropic.com')
    ? new Response(JSON.stringify({ content: [{ type: 'text', text: 'PASS' }] }), { status: 200 })
    : realFetch(url, opts));
  try {
    const { jar } = await signInDev('curious.student@gmail.com');
    const r = await req('POST', '/api/tutor', { jar, json: { question: 'May I use a different agent?' } });
    assert.equal(r.json().passed, true);
    const row = db.get('SELECT * FROM tutor_passed WHERE question = ?', 'May I use a different agent?');
    assert.ok(row);
    assert.ok(!Object.values(row).map(String).some(v => v.includes('curious')));
  } finally {
    globalThis.fetch = original;
  }
});
