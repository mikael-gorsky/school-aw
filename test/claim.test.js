// After a refused sign-in, a student may name the address on the list, and its
// place on the list moves to the Google address they use (decision of
// 17 November 2026). These tests guard the limits of that rule: it needs the
// token of the refused sign-in, an address on a list that nobody registered
// with, and never a demo, sample or teacher address.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, stop, db } from './helpers.js';

after(stop);

const teacher = await signInDev('teacher@example.com');
await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'listed.one@gmail.com\nlisted.two@gmail.com\nlisted.three@gmail.com', institution: 'Holon Institute of Technology', code: 'claim-1', programme: 'ase' } });
const group = db.get("SELECT * FROM groups WHERE code = 'claim-1'");

async function refused(email) {
  const { r } = await signInDev(email);
  return r.location.match(/&r=([0-9a-f]{32})$/)[1];
}
const claim = (token, email, jar = {}) => req('POST', '/auth/claim', { jar, form: { r: token, email } });

test('the refused page asks for the address on the list', async () => {
  const token = await refused('other.one@gmail.com');
  const page = await req('GET', `/register?e=refused&r=${token}`);
  assert.match(page.text, /action="\/auth\/claim"/);
  assert.match(page.text, new RegExp(`name="r" value="${token}"`));
});

test('naming a listed address moves its place to the Google address and signs the student in', async () => {
  const token = await refused('other.one@gmail.com');
  const jar = {};
  const r = await claim(token, 'Listed.One@gmail.com', jar);
  assert.equal(r.location, '/register?done=1');
  assert.ok(jar.cookie);
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'listed.one@gmail.com'), undefined);
  assert.equal(db.get('SELECT group_id FROM permitted WHERE email = ?', 'other.one@gmail.com').group_id, group.id);
  const u = db.get('SELECT * FROM users WHERE email = ?', 'other.one@gmail.com');
  assert.equal(u.group_id, group.id);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM refused WHERE email = ? AND handled = 0', 'other.one@gmail.com').n, 0);
  // From now on the Google address signs in directly.
  assert.equal((await signInDev('other.one@gmail.com')).r.location, '/program');
  // The teacher sees the change.
  const access = await req('GET', `/teacher/access?group=${group.id}`, { jar: teacher.jar });
  assert.match(access.text, /addresses changed by students/);
  assert.match(access.text, /listed\.one@gmail\.com → other\.one@gmail\.com/);
});

test('a token works once', async () => {
  const token = await refused('other.two@gmail.com');
  await claim(token, 'listed.two@gmail.com');
  const again = await claim(token, 'listed.three@gmail.com');
  assert.match(again.location, /^\/register\?e=This/);
  assert.ok(db.get('SELECT * FROM permitted WHERE email = ?', 'listed.three@gmail.com'));
});

test('without a valid token nothing changes', async () => {
  for (const t of ['', 'abc', '0'.repeat(32)]) {
    const jar = {};
    const r = await claim(t, 'listed.three@gmail.com', jar);
    assert.equal(r.status, 303);
    assert.equal(jar.cookie, undefined);
  }
  assert.ok(db.get('SELECT * FROM permitted WHERE email = ?', 'listed.three@gmail.com'));
});

test('an expired token does nothing', async () => {
  const token = await refused('late.one@gmail.com');
  db.run('UPDATE refused SET at = ? WHERE token = ?', new Date(Date.now() - 31 * 60e3).toISOString(), token);
  await claim(token, 'listed.three@gmail.com');
  assert.ok(db.get('SELECT * FROM permitted WHERE email = ?', 'listed.three@gmail.com'));
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'late.one@gmail.com'), undefined);
});

test('an address not on any list, or already registered, is not taken', async () => {
  const token = await refused('other.three@gmail.com');
  const unknown = await claim(token, 'nobody@gmail.com');
  assert.match(unknown.location, /m=unknown$/);
  // listed.two now belongs to other.two, who registered with it.
  const taken = await claim(token, 'other.two@gmail.com');
  assert.match(taken.location, /m=unknown$|m=taken$/);
  await signInDev('listed.three@gmail.com');
  const reg = await claim(token, 'listed.three@gmail.com');
  assert.match(reg.location, /m=taken$/);
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'other.three@gmail.com'), undefined);
});

test('a teacher or demo address can never be claimed', async () => {
  const token = await refused('other.four@gmail.com');
  for (const e of ['teacher@example.com', 'demo']) {
    const r = await claim(token, e);
    assert.match(r.location, /m=unknown$/);
  }
  const sample = db.get("SELECT email FROM users WHERE role = 'sample' LIMIT 1");
  if (sample) assert.match((await claim(token, sample.email)).location, /m=unknown$|m=taken$/);
  assert.equal(db.get('SELECT * FROM users WHERE email = ?', 'other.four@gmail.com'), undefined);
});

test('the sign-in pages tell students to leave the Gmail or WhatsApp app', async () => {
  for (const p of ['/signin', '/register']) {
    const page = await req('GET', p);
    if (/Google sign-in is not set up/.test(page.text)) continue;
    assert.match(page.text, /not inside the Gmail or WhatsApp app/);
  }
});
