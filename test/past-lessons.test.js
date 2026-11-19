import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { req, signInDev, db, stop } from './helpers.js';
import { addLesson } from '../server/model.js';

after(stop);
const teacher = await signInDev('teacher@example.com');

test('a past lesson that was never run shows as past, with no Start button, and cannot be started', async () => {
  await req('POST', '/teacher/access/permit', { jar: teacher.jar, form: { emails: 'past.user@gmail.com', institution: 'Test', code: 'past-1', programme: 'ase' } });
  const g = db.get("SELECT id FROM groups WHERE code = 'past-1'");
  const day = 864e5;
  const iso = ms => new Date(ms).toISOString();
  const old = addLesson(g.id, 1, [1], iso(Date.now() - 7 * day), null, { endsAt: iso(Date.now() - 7 * day + 3 * 36e5) });
  const soon = addLesson(g.id, 2, [2], iso(Date.now() + 7 * day), null, { endsAt: iso(Date.now() + 7 * day + 3 * 36e5) });

  const page = (await req('GET', `/teacher/class?group=${g.id}`, { jar: teacher.jar })).text;
  assert.match(page, /past, not run on the site/);
  assert.equal((page.match(/value="start">Start lesson/g) || []).length, 1);
  assert.match(page, new RegExp(`name="lesson" value="${soon.id}"`));
  assert.doesNotMatch(page, new RegExp(`name="lesson" value="${old.id}"`));

  await req('POST', '/teacher/class/act', { jar: teacher.jar, form: { group: g.id, action: 'start', lesson: old.id } });
  assert.equal(db.get('SELECT state FROM lessons WHERE id = ?', old.id).state, 'planned');
  await req('POST', '/teacher/class/act', { jar: teacher.jar, form: { group: g.id, action: 'start', lesson: soon.id } });
  assert.equal(db.get('SELECT state FROM lessons WHERE id = ?', soon.id).state, 'live');
});
