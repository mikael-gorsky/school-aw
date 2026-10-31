// My account: a user's name, photo and comment are open to that user and to the
// teacher, and to nobody else. Names from Google never replace a name the user
// corrected (decision of 31 October 2026).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, signInDemo, stop, db } from './helpers.js';
import { applyProfile } from '../server/auth.js';

after(stop);

const teacher = await signInDev('teacher@example.com');
await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'ann@gmail.com\nben@gmail.com', institution: 'Test', code: 'acct', programme: 'ase' } });
const ann = await signInDev('ann@gmail.com');
const ben = await signInDev('ben@gmail.com');
const annId = db.get('SELECT id FROM users WHERE email = ?', 'ann@gmail.com').id;
const benId = db.get('SELECT id FROM users WHERE email = ?', 'ben@gmail.com').id;
db.run("INSERT INTO user_photos(user_id, type, data, updated_at) VALUES(?, 'image/png', ?, ?)", benId, new Uint8Array([1, 2, 3]), new Date().toISOString());

test('a visitor sees My account in a general form and cannot save it', async () => {
  const page = await req('GET', '/account');
  assert.equal(page.status, 200);
  assert.match(page.text, /example screen/);
  const r = await req('POST', '/account', { form: { first_name: 'X' } });
  assert.equal(r.location, '/signin');
});

test('the header shows the last name and status, and it opens My account', async () => {
  db.run('UPDATE users SET last_name = ? WHERE id = ?', 'Gold', annId);
  const page = await req('GET', '/program', { jar: ann.jar });
  assert.match(page.text, /<a class="who" href="\/account"[^>]*>.*Gold · student<\/a>/);
  const t = await req('GET', '/teacher/progress', { jar: teacher.jar });
  assert.match(t.text, /href="\/account"[^>]*>.*· teacher<\/a>/);
});

test('My account saves the names and the comment, and holds Sign out', async () => {
  const r = await req('POST', '/account', { jar: ann.jar, form: { first_name: 'Ann', last_name: 'Gold', comment: 'I join on Zoom.' } });
  assert.equal(r.location, '/account');
  const u = db.get('SELECT * FROM users WHERE id = ?', annId);
  assert.deepEqual([u.first_name, u.last_name, u.comment], ['Ann', 'Gold', 'I join on Zoom.']);
  const page = await req('GET', '/account', { jar: ann.jar });
  assert.match(page.text, /I join on Zoom\./);
  assert.match(page.text, /action="\/auth\/signout"/);
});

test('a comment is cut at 2000 characters', async () => {
  await req('POST', '/account', { jar: ann.jar, form: { first_name: 'Ann', last_name: 'Gold', comment: 'x'.repeat(5000) } });
  assert.equal(db.get('SELECT comment FROM users WHERE id = ?', annId).comment.length, 2000);
});

test('a student cannot see another student’s photo or details', async () => {
  assert.equal((await req('GET', `/photo/${benId}`, { jar: ann.jar })).status, 404);
  assert.equal((await req('GET', `/photo/${benId}`, { jar: ben.jar })).status, 200);
  assert.equal((await req('GET', `/teacher/student/${benId}`, { jar: ann.jar })).status, 403);
  assert.equal((await req('GET', `/photo/${benId}`)).status, 401);
});

test('the demo login cannot see a real student’s photo or details', async () => {
  const demo = await signInDemo();
  assert.equal((await req('GET', `/photo/${benId}`, { jar: demo.jar })).status, 404);
  assert.equal((await req('GET', `/teacher/student/${annId}`, { jar: demo.jar })).status, 403);
});

test('the teacher sees a student’s name, comment and photo', async () => {
  db.run('UPDATE users SET comment = ? WHERE id = ?', 'Needs extra time', annId);
  const page = await req('GET', `/teacher/student/${annId}`, { jar: teacher.jar });
  assert.equal(page.status, 200);
  assert.match(page.text, /Ann Gold/);
  assert.match(page.text, /Needs extra time/);
  assert.equal((await req('GET', `/photo/${benId}`, { jar: teacher.jar })).status, 200);
  const list = await req('GET', '/teacher/access', { jar: teacher.jar });
  assert.match(list.text, new RegExp(`href="/teacher/student/${annId}"[^>]*>Ann Gold</a>`));
});

test('names from Google fill only empty fields', async () => {
  const id = db.get('SELECT id FROM users WHERE email = ?', 'ben@gmail.com').id;
  await applyProfile(id, { first: 'Benjamin', last: 'Stone', picture: '' });
  await applyProfile(id, { first: 'Other', last: 'Name', picture: '' });
  const u = db.get('SELECT first_name, last_name FROM users WHERE id = ?', id);
  assert.deepEqual([u.first_name, u.last_name], ['Benjamin', 'Stone']);
  await applyProfile(annId, { first: 'Anna', last: 'Goldberg', picture: '' });
  assert.equal(db.get('SELECT last_name FROM users WHERE id = ?', annId).last_name, 'Gold');
});

test('a photo is copied only from Google’s photo servers', async () => {
  const asked = [];
  const original = globalThis.fetch;
  globalThis.fetch = async url => { asked.push(String(url)); return new Response(new Uint8Array([9]), { headers: { 'content-type': 'image/jpeg' } }); };
  try {
    await applyProfile(annId, { picture: 'https://evil.example.com/a.jpg' });
    await applyProfile(annId, { picture: 'http://lh3.googleusercontent.com/a.jpg' });
    assert.equal(asked.length, 0);
    await applyProfile(annId, { picture: 'https://lh3.googleusercontent.com/a/x=s96-c' });
    assert.equal(asked.length, 1);
    assert.equal(db.get('SELECT type FROM user_photos WHERE user_id = ?', annId).type, 'image/jpeg');
  } finally {
    globalThis.fetch = original;
  }
});

test('names on the teacher’s list are used at registration, and Google does not replace them', async () => {
  const g = db.get("SELECT id FROM groups WHERE code = 'acct'");
  db.run('INSERT INTO permitted(email, group_id, added_at, first_name, last_name) VALUES(?, ?, ?, ?, ?)', 'dor@gmail.com', g.id, new Date().toISOString(), 'Dor', 'Avital');
  const list = await req('GET', `/teacher/access?group=${g.id}`, { jar: teacher.jar });
  assert.match(list.text, /Dor Avital/);
  await signInDev('dor@gmail.com');
  const u = db.get('SELECT * FROM users WHERE email = ?', 'dor@gmail.com');
  await applyProfile(u.id, { first: 'דור', last: 'אביטל', picture: '' });
  const after = db.get('SELECT first_name, last_name FROM users WHERE id = ?', u.id);
  assert.deepEqual([after.first_name, after.last_name], ['Dor', 'Avital']);
});

test('a CSV with names and institution adds students, and the names stay editable', async () => {
  const csv = 'first name,last name,email,group,institution\nNoa,Bar,noa.bar@gmail.com,9,Test college\n,,nameless@gmail.com,9,Test college';
  const r = await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { csv, emails: '', institution: '', code: '', programme: 'ase' } });
  assert.equal(r.status, 303);
  const g = db.get("SELECT * FROM groups WHERE institution = 'Test college' AND code = '9'");
  assert.ok(g);
  assert.equal(db.get('SELECT first_name FROM permitted WHERE email = ?', 'noa.bar@gmail.com').first_name, 'Noa');
  assert.equal(db.get('SELECT first_name FROM permitted WHERE email = ?', 'nameless@gmail.com').first_name, null);

  const noa = await signInDev('noa.bar@gmail.com');
  const id = db.get('SELECT id FROM users WHERE email = ?', 'noa.bar@gmail.com').id;
  await req('POST', '/account', { jar: noa.jar, form: { first_name: 'Noya', last_name: '', comment: '' } });
  await signInDev('noa.bar@gmail.com');
  await applyProfile(id, { first: 'Google', last: 'Name', picture: '' });
  const u = db.get('SELECT first_name, last_name FROM users WHERE id = ?', id);
  assert.deepEqual([u.first_name, u.last_name], ['Noya', '']);
});

test('an address without an institution or group is not added', async () => {
  const r = await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'lost@gmail.com', institution: '', code: '', programme: 'ase' } });
  assert.equal(r.status, 303);
  assert.equal(db.get('SELECT * FROM permitted WHERE email = ?', 'lost@gmail.com'), undefined);
});

test('the teacher adds a lesson of 2 modules, and it takes the live exercises of both', async () => {
  const g = db.get("SELECT id FROM groups WHERE code = 'acct'");
  const r = await req('POST', '/teacher/class/act', { jar: teacher.jar, form: { group: g.id, action: 'add-lesson', number: '3', module: '4', module2: '6' } });
  assert.equal(r.status, 303);
  const l = db.get('SELECT * FROM lessons WHERE group_id = ? AND number = 3', g.id);
  assert.deepEqual(JSON.parse(l.modules), [4, 6]);
  const labels = db.all('SELECT label FROM items WHERE lesson_id = ?', l.id).map(i => i.label);
  assert.ok(labels.some(x => x.startsWith('Module 4 · ')) && labels.some(x => x.startsWith('Module 6 · ')));
});
