// The demo login is a sample student: it sees only the student side, it can
// never open a teacher page, and what is entered under it is deleted every
// night (CLAUDE.md, rules of the product; decision of 31 October 2026).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDemo, signInDev, stop, db, demo } from './helpers.js';
import { admit } from '../server/auth.js';
import { voterKey } from '../server/db.js';

after(stop);

const TEACHER_PAGES = ['/teacher/progress', '/teacher/class', '/teacher/class/live', '/teacher/study', '/teacher/projects', '/teacher/exam', '/teacher/satisfaction', '/teacher/access', '/teacher/agents', '/teacher/export.csv'];

test('a wrong demo password is refused', async () => {
  const { r, jar } = await signInDemo('wrong');
  assert.equal(r.location, '/signin?e=demo');
  assert.equal(jar.cookie, undefined);
});

test('the demo login opens the student side', async () => {
  const { r, jar } = await signInDemo();
  assert.equal(r.location, '/program');
  for (const p of ['/program', '/class', '/study', '/projects', '/exam', '/progress']) {
    assert.equal((await req('GET', p, { jar })).status, 200, p);
  }
});

test('the demo login can never open a teacher page', async () => {
  const { jar } = await signInDemo();
  for (const p of TEACHER_PAGES) assert.equal((await req('GET', p, { jar })).status, 403, p);
});

test('the demo login cannot use any teacher action', async () => {
  const { jar } = await signInDemo();
  const actions = [
    ['/teacher/access/permit', { emails: 'friend@gmail.com', institution: 'X', code: '1' }],
    ['/teacher/access/demo-reset', {}],
    ['/teacher/class/act', { action: 'end' }],
    ['/teacher/satisfaction/survey', { action: 'open' }],
    ['/teacher/exam/settings', { exam_date: 'tomorrow' }],
  ];
  for (const [p, form] of actions) assert.equal((await req('POST', p, { jar, form })).status, 403, p);
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'friend@gmail.com'), undefined);
  assert.equal(db.get("SELECT value FROM settings WHERE key = 'exam_date'"), undefined);
});

test('the demo login has no teacher links in its pages', async () => {
  const { jar } = await signInDemo();
  const page = await req('GET', '/program', { jar });
  assert.doesNotMatch(page.text, /href="\/teacher/);
});

test('the demo account cannot be entered through Google or the list', () => {
  assert.equal(admit('demo').refused, true);
  const sample = db.get("SELECT email FROM users WHERE role = 'sample' LIMIT 1");
  assert.equal(admit(sample.email).refused, true);
});

test('a teacher address on the list is still the teacher, and the demo stays a student', async () => {
  const { r } = await signInDev('teacher@example.com');
  assert.equal(r.location, '/teacher/progress');
  assert.equal(db.get("SELECT role FROM users WHERE email = 'demo'").role, 'demo');
});

test('the nightly reset deletes what was entered under the demo login', async () => {
  const { jar } = await signInDemo();
  const user = db.get("SELECT * FROM users WHERE role = 'demo'");
  const g = demo.demoGroup();
  // The last lesson that is over is the one the demo login has not rated yet.
  const lesson8 = db.get("SELECT * FROM lessons WHERE group_id = ? AND state = 'ended' ORDER BY number DESC LIMIT 1", g.id);
  await req('POST', '/class/rate', { jar, form: { lesson: lesson8.id, rating: '2', comment: 'A comment typed by a visitor.' } });
  assert.ok(db.get('SELECT * FROM lesson_ratings WHERE voter = ?', voterKey(user.id, `lesson:${lesson8.id}`)));
  await req('POST', '/study/1/practice', { jar, form: { exercise: 'e3', answer: 'Something typed by a visitor.' } });
  await req('POST', '/contact', { form: { email: 'visitor@example.org', body: 'hello' } });

  demo.resetDemo();

  const after = db.get("SELECT * FROM users WHERE role = 'demo'");
  const g2 = demo.demoGroup();
  const l8 = db.get('SELECT * FROM lessons WHERE group_id = ? AND number = ?', g2.id, lesson8.number);
  assert.equal(db.get('SELECT * FROM lesson_ratings WHERE voter = ?', voterKey(after.id, `lesson:${l8.id}`)), undefined);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM lesson_ratings WHERE comment = 'A comment typed by a visitor.'").n, 0);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM practice WHERE answer = 'Something typed by a visitor.'").n, 0);
  // The old session ends with the reset.
  assert.equal((await req('GET', '/class/live', { jar })).status, 401);
});

test('a program without an exam shows no Exam finale', async () => {
  const { jar } = await signInDemo();
  const page = await req('GET', '/program', { jar });
  assert.doesNotMatch(page.text, /href="\/exam"/);
  const exam = await req('GET', '/exam', { jar });
  assert.equal(exam.status, 200);
  assert.match(exam.text, /no final exam/i);
  const visitor = await req('GET', '/');
  assert.doesNotMatch(visitor.text, /href="\/exam"/);
});

test('the demo lessons follow the lesson plan, with 2 modules in a lesson', () => {
  const g = demo.demoGroup();
  const lessons = db.all('SELECT * FROM lessons WHERE group_id = ? ORDER BY number', g.id);
  assert.equal(lessons.length, 11);
  assert.deepEqual(JSON.parse(lessons[2].modules), [4, 6]);
  const labels = db.all('SELECT label FROM items WHERE lesson_id = ?', lessons[2].id).map(i => i.label);
  assert.ok(labels.some(l => l.startsWith('Module 4 · ')) && labels.some(l => l.startsWith('Module 6 · ')));
});
