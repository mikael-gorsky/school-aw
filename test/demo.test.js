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
  assert.equal(r.location, '/programme');
  for (const p of ['/programme', '/class', '/study', '/projects', '/exam', '/progress']) {
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
  const page = await req('GET', '/programme', { jar });
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
  const lesson8 = db.get('SELECT * FROM lessons WHERE group_id = ? AND number = 8', g.id);
  await req('POST', '/class/rate', { jar, form: { lesson: lesson8.id, rating: '2', comment: 'A comment typed by a visitor.' } });
  assert.ok(db.get('SELECT * FROM lesson_ratings WHERE voter = ?', voterKey(user.id, `lesson:${lesson8.id}`)));
  await req('POST', '/study/1/practice', { jar, form: { exercise: 'e3', answer: 'Something typed by a visitor.' } });
  await req('POST', '/contact', { form: { email: 'visitor@example.org', body: 'hello' } });

  demo.resetDemo();

  const after = db.get("SELECT * FROM users WHERE role = 'demo'");
  const g2 = demo.demoGroup();
  const l8 = db.get('SELECT * FROM lessons WHERE group_id = ? AND number = 8', g2.id);
  assert.equal(db.get('SELECT * FROM lesson_ratings WHERE voter = ?', voterKey(after.id, `lesson:${l8.id}`)), undefined);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM lesson_ratings WHERE comment = 'A comment typed by a visitor.'").n, 0);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM practice WHERE answer = 'Something typed by a visitor.'").n, 0);
  // The old session ends with the reset.
  assert.equal((await req('GET', '/class/live', { jar })).status, 401);
});
