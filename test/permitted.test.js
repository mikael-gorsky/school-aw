// The list of permitted addresses decides who may register, and the group comes
// from the list (CLAUDE.md, rules of the product; decision of 31 October 2026).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, stop, db } from './helpers.js';

after(stop);

const teacher = await signInDev('teacher@example.com');

test('the teacher signs in as the teacher', () => {
  assert.equal(teacher.r.status, 303);
  assert.equal(teacher.r.location, '/teacher/progress');
});

test('an address that is not on any list is refused and recorded', async () => {
  const { r, jar } = await signInDev('stranger@gmail.com');
  assert.equal(r.status, 303);
  assert.equal(r.location, '/register?e=refused');
  assert.equal(jar.cookie, undefined);
  assert.ok(db.get('SELECT * FROM refused WHERE email = ?', 'stranger@gmail.com'));
  assert.equal(db.get('SELECT * FROM users WHERE email = ?', 'stranger@gmail.com'), undefined);
});

test('a permitted address registers into the group on the list', async () => {
  const p = await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'Student.One@Gmail.com\nstudent.two@gmail.com', institution: 'Holon Institute of Technology', code: '62121-31', programme: 'ase' } });
  assert.equal(p.status, 303);
  const g = db.get("SELECT * FROM groups WHERE code = '62121-31'");
  assert.equal(g.institution, 'Holon Institute of Technology');
  assert.equal(db.get('SELECT group_id FROM permitted WHERE email = ?', 'student.one@gmail.com').group_id, g.id);

  const { r, jar } = await signInDev('student.one@gmail.com');
  assert.equal(r.location, '/register?done=1');
  const u = db.get('SELECT * FROM users WHERE email = ?', 'student.one@gmail.com');
  assert.equal(u.role, 'student');
  assert.equal(u.group_id, g.id);
  const page = await req('GET', '/register?done=1', { jar });
  assert.match(page.text, /62121-31/);
  assert.match(page.text, /Holon Institute of Technology/);
});

test('a student never enters an institution or group: the form has no such field', async () => {
  const page = await req('GET', '/register');
  assert.doesNotMatch(page.text, /name="(institution|group|code|programme)"/);
});

test('a student cannot open or change teacher pages', async () => {
  const { jar } = await signInDev('student.two@gmail.com');
  for (const p of ['/teacher/progress', '/teacher/access', '/teacher/satisfaction', '/teacher/class', '/teacher/export.csv']) {
    const r = await req('GET', p, { jar });
    assert.equal(r.status, 403, p);
  }
  const before = db.get('SELECT COUNT(*) AS n FROM permitted').n;
  const r = await req('POST', '/teacher/access/permit', { jar, form: { emails: 'friend@gmail.com', institution: 'X', code: '1' } });
  assert.equal(r.status, 403);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM permitted').n, before);
});

test('moving an address to another group moves the student', async () => {
  await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'student.two@gmail.com', institution: 'Holon Institute of Technology', code: '62121-32', programme: 'ase' } });
  const g2 = db.get("SELECT * FROM groups WHERE code = '62121-32'");
  const { jar } = await signInDev('student.two@gmail.com');
  await req('GET', '/program', { jar });
  assert.equal(db.get('SELECT group_id FROM users WHERE email = ?', 'student.two@gmail.com').group_id, g2.id);
});

test('removing an address from the list ends the access at once', async () => {
  const { jar } = await signInDev('student.one@gmail.com');
  assert.equal((await req('GET', '/class/live', { jar })).status, 200);
  await req('POST', '/teacher/access/remove', { jar: teacher.jar, form: { email: 'student.one@gmail.com' } });
  assert.equal((await req('GET', '/class/live', { jar })).status, 401);
  const again = await signInDev('student.one@gmail.com');
  assert.equal(again.r.location, '/register?e=refused');
});

test('a form sent from another site is refused', async () => {
  const r = await req('POST', '/teacher/access/permit', { jar: teacher.jar, headers: { origin: 'https://evil.example' }, form: { emails: 'x@gmail.com', institution: 'X', code: '1' } });
  assert.equal(r.status, 403);
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'x@gmail.com'), undefined);
});
