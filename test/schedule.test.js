import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, db, stop } from './helpers.js';
import { importSchedule, israelToIso, lessonPhase, scheduleContext } from '../server/schedule.js';

after(stop);
const teacher = await signInDev('teacher@example.com');

const SCHED = {
  term: 'Test term', timeZone: 'Asia/Jerusalem', breaks: ['No class on Sunday 6 December 2026 (Hanukkah).'],
  groups: [{ code: 'sched-1', day: 'Sunday', from: '10:00', to: '13:00', dates: ['2026-10-18', '2026-11-01', '2026-11-08'] }],
  lessons: [{ n: 1, modules: [1] }, { n: 2, modules: [4, 6] }, { n: 3, note: 'Project work and presentations', modules: [] }],
};

test('Israel time is turned into UTC on both sides of the clock change', () => {
  assert.equal(israelToIso('2026-10-18', '10:00'), '2026-10-18T07:00:00.000Z');
  assert.equal(israelToIso('2026-11-01', '10:00'), '2026-11-01T08:00:00.000Z');
});

test('the schedule is imported into the group, can run again, and keeps answers', async () => {
  await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'sched.user@gmail.com', institution: 'Test', code: 'sched-1', programme: 'ase' } });
  assert.deepEqual(importSchedule('ase', SCHED), { groups: 1, lessons: 3 });
  const g = db.get("SELECT * FROM groups WHERE code = 'sched-1'");
  const ls = db.all('SELECT * FROM lessons WHERE group_id = ? ORDER BY number', g.id);
  assert.equal(ls.length, 3);
  assert.equal(ls[1].starts_at, '2026-11-01T08:00:00.000Z');
  assert.equal(ls[1].ends_at, '2026-11-01T11:00:00.000Z');
  assert.equal(ls[1].modules, '[4,6]');
  assert.equal(ls[2].note, 'Project work and presentations');
  assert.equal(db.get('SELECT COUNT(*) AS n FROM items WHERE lesson_id = ?', ls[2].id).n, 0);
  // Again, with a new date: the same lessons, moved.
  const moved = structuredClone(SCHED);
  moved.groups[0].dates[2] = '2026-11-15';
  importSchedule('ase', moved);
  assert.equal(db.all('SELECT * FROM lessons WHERE group_id = ?', g.id).length, 3);
  assert.equal(db.get('SELECT starts_at FROM lessons WHERE id = ?', ls[2].id).starts_at, '2026-11-15T08:00:00.000Z');
});

test('a lesson is held, today or coming by the date in Israel', () => {
  const l = { state: 'planned', starts_at: '2026-11-01T08:00:00.000Z', ends_at: '2026-11-01T11:00:00.000Z' };
  assert.equal(lessonPhase(l, new Date('2026-10-31T12:00:00Z')), 'coming');
  assert.equal(lessonPhase(l, new Date('2026-11-01T06:00:00Z')), 'today');
  assert.equal(lessonPhase(l, new Date('2026-11-01T12:00:00Z')), 'held');
  assert.equal(lessonPhase({ ...l, state: 'live' }, new Date('2026-11-01T12:00:00Z')), 'live');
});

test('the Teaching Assistant gets the date and the group schedule, without names', () => {
  const g = db.get("SELECT * FROM groups WHERE code = 'sched-1'");
  const t = scheduleContext(g, new Date('2026-11-01T06:00:00Z'));
  assert.match(t, /^Today is Sunday, November 1, 2026/);
  assert.match(t, /Lesson 2, Sun, Nov 1, 2026, 10:00–13:00 \[today\]/);
  assert.match(t, /Lesson 3, .*Project work and presentations/);
  assert.match(t, /Hanukkah/);
  assert.ok(!t.includes('sched.user'));
});

test('My program shows the schedule of the student\'s own group', async () => {
  const { jar } = await signInDev('sched.user@gmail.com');
  const r = await req('GET', '/program', { jar });
  const html = r.text;
  assert.match(html, /Your schedule/);
  assert.match(html, /Project work and presentations/);
  const visitor = (await req('GET', '/program')).text;
  assert.ok(!visitor.includes('Your schedule'));
});
