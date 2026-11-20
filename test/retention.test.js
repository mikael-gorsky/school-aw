// A group's data is deleted 4 months after its course ends, and only 7 days
// after the teacher marks the notice to students sent (decision of
// 20 November 2026).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { req, signInDev, db, stop } from './helpers.js';
import { addLesson } from '../server/model.js';
import { voterKey } from '../server/db.js';
import { retentionOf, retentionCheck, pruneBackups } from '../server/retention.js';

after(stop);
const DAY = 864e5;
const iso = ms => new Date(ms).toISOString();
const teacher = await signInDev('teacher@example.com');

async function groupWithStudent(code, email, lessonAt) {
  await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: email, institution: 'Ret', code, programme: 'ase' } });
  await signInDev(email);
  const g = db.get('SELECT * FROM groups WHERE code = ?', code);
  const u = db.get('SELECT * FROM users WHERE email = ?', email);
  const l = addLesson(g.id, 1, [1], iso(lessonAt), null, { endsAt: iso(lessonAt + 3 * 36e5) });
  const item = db.get('SELECT id FROM items WHERE lesson_id = ? LIMIT 1', l.id);
  db.run('INSERT INTO answers(item_id, user_id, choice, at) VALUES(?, ?, ?, ?)', item.id, u.id, 'a', iso(lessonAt));
  db.run('INSERT INTO lesson_ratings(lesson_id, voter, rating, at) VALUES(?, ?, 5, ?)', l.id, voterKey(u.id, `lesson:${l.id}`), iso(lessonAt));
  db.run("INSERT INTO messages(name, email, topic, body, at) VALUES('x', ?, 'q', 'hi', ?)", email, iso(Date.now()));
  return { g, u, l };
}

test('the notice cannot be marked before it is due, and nothing is deleted without it', async () => {
  const { g, u } = await groupWithStudent('ret-early', 'early@gmail.com', Date.now() - 30 * DAY);
  const r = retentionOf(g);
  assert.ok(Date.parse(r.noticeDue) > Date.now());
  assert.equal(r.canSend, false);
  await req('POST', '/teacher/access/notice', { jar: teacher.jar, form: { group: g.id, action: 'sent' } });
  assert.equal(db.get('SELECT notice_sent_at FROM groups WHERE id = ?', g.id).notice_sent_at, null);
  retentionCheck(Date.now() + 400 * DAY);
  assert.ok(db.get('SELECT id FROM users WHERE id = ?', u.id));
});

test('after the notice, the group’s data is deleted 7 days later, and ratings stay anonymous', async () => {
  const { g, u, l } = await groupWithStudent('ret-old', 'old@gmail.com', Date.now() - 200 * DAY);
  const other = await groupWithStudent('ret-keep', 'keep@gmail.com', Date.now() - 200 * DAY);
  const page = await req('GET', `/teacher/access?group=${g.id}`, { jar: teacher.jar });
  assert.match(page.text, /data of this group/);
  assert.match(page.text, /value="sent"[^>]*>Notice sent/);

  await req('POST', '/teacher/access/notice', { jar: teacher.jar, form: { group: g.id, action: 'sent' } });
  assert.ok(db.get('SELECT notice_sent_at FROM groups WHERE id = ?', g.id).notice_sent_at);
  assert.match((await req('GET', `/teacher/access?group=${g.id}`, { jar: teacher.jar })).text, /will be deleted on/);

  retentionCheck(Date.now() + 6 * DAY);
  assert.ok(db.get('SELECT id FROM users WHERE id = ?', u.id));
  retentionCheck(Date.now() + 8 * DAY);
  assert.equal(db.get('SELECT id FROM users WHERE id = ?', u.id), undefined);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM permitted WHERE group_id = ?', g.id).n, 0);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM answers WHERE user_id = ?', u.id).n, 0);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM messages WHERE email = 'old@gmail.com'").n, 0);
  const ratings = db.all('SELECT voter FROM lesson_ratings WHERE lesson_id = ?', l.id);
  assert.equal(ratings.length, 1);
  assert.match(ratings[0].voter, /^gone:/);
  assert.ok(db.get('SELECT purged_at FROM groups WHERE id = ?', g.id).purged_at);
  // Another group whose notice was not sent keeps everything.
  assert.ok(db.get('SELECT id FROM users WHERE id = ?', other.u.id));
  assert.equal(db.get("SELECT COUNT(*) AS n FROM messages WHERE email = 'keep@gmail.com'").n, 1);
  assert.match((await req('GET', `/teacher/access?group=${g.id}`, { jar: teacher.jar })).text, /was deleted on/);
});

test('the teacher can stop a deletion before it happens', async () => {
  const { g, u } = await groupWithStudent('ret-stop', 'stop@gmail.com', Date.now() - 200 * DAY);
  await req('POST', '/teacher/access/notice', { jar: teacher.jar, form: { group: g.id, action: 'sent' } });
  await req('POST', '/teacher/access/notice', { jar: teacher.jar, form: { group: g.id, action: 'cancel' } });
  assert.equal(db.get('SELECT notice_sent_at FROM groups WHERE id = ?', g.id).notice_sent_at, null);
  retentionCheck(Date.now() + 30 * DAY);
  assert.ok(db.get('SELECT id FROM users WHERE id = ?', u.id));
});

test('refused addresses go after 30 days, contact messages after 4 months', () => {
  db.run("INSERT INTO refused(email, at) VALUES('stale@gmail.com', ?)", iso(Date.now() - 31 * DAY));
  db.run("INSERT INTO refused(email, at) VALUES('fresh@gmail.com', ?)", iso(Date.now() - 2 * DAY));
  db.run("INSERT INTO messages(name, email, topic, body, at) VALUES('v', 'v@x.com', 'q', 'old', ?)", iso(Date.now() - 130 * DAY));
  retentionCheck();
  assert.equal(db.get("SELECT COUNT(*) AS n FROM refused WHERE email = 'stale@gmail.com'").n, 0);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM refused WHERE email = 'fresh@gmail.com'").n, 1);
  assert.equal(db.get("SELECT COUNT(*) AS n FROM messages WHERE body = 'old'").n, 0);
});

test('backups older than 30 days are deleted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saw-bk-'));
  const oldF = path.join(dir, 'saw-old.db'), newF = path.join(dir, 'saw-new.db'), other = path.join(dir, 'notes.txt');
  for (const f of [oldF, newF, other]) fs.writeFileSync(f, 'x');
  const past = new Date(Date.now() - 31 * DAY);
  fs.utimesSync(oldF, past, past);
  fs.utimesSync(other, past, past);
  assert.equal(pruneBackups(dir), 1);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['notes.txt', 'saw-new.db']);
  fs.rmSync(dir, { recursive: true });
});
