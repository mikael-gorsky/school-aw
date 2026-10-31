// @reviewer checks structure and history only, and never grades.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, judgeCommits, judgeTree, feedbackFrom } from '../server/reviewer.js';

const commit = (date, message) => ({ commit: { author: { date }, message } });

test('only GitHub repository addresses are accepted', () => {
  assert.deepEqual(parseRepo('https://github.com/name/project.git'), { owner: 'name', repo: 'project', url: 'https://github.com/name/project' });
  assert.equal(parseRepo('https://gitlab.com/name/project'), null);
  assert.equal(parseRepo('javascript:alert(1)'), null);
});

test('work spread over weeks passes, and work done in a day fails', () => {
  const spread = Array.from({ length: 12 }, (_, i) => commit(new Date(Date.UTC(2026, 8, 1 + i * 3)).toISOString(), 'Add the login page and its tests'));
  assert.equal(judgeCommits(spread).spread.state, 'ok');
  const rushed = Array.from({ length: 12 }, (_, i) => commit(new Date(Date.UTC(2026, 8, 1, i)).toISOString(), 'Add a part of the site'));
  assert.equal(judgeCommits(rushed).spread.state, 'bad');
});

test('one-word commit messages are reported', () => {
  const list = ['fix', 'update', 'Add the login page', 'Write tests for the list of addresses'].map((m, i) => commit(new Date(Date.UTC(2026, 8, 1 + i * 5)).toISOString(), m));
  const r = judgeCommits(list).messages;
  assert.equal(r.state, 'bad');
  assert.match(r.detail, /2 of 4/);
});

test('the context file, tests and a record of the work are found', () => {
  const t = judgeTree(['CLAUDE.md', 'src/app.js', 'test/app.test.js', 'docs/sessions/2026-09-01.md']);
  assert.deepEqual(t, { context: true, tests: true, record: true });
  assert.deepEqual(judgeTree(['src/app.js', 'README.md']), { context: false, tests: false, record: false });
});

test('the feedback explains each failed check and gives no grade', () => {
  const fb = feedbackFrom([{ key: 'public', state: 'ok' }, { key: 'context', state: 'ok' }, { key: 'tests', state: 'bad' }]);
  assert.match(fb, /Add tests/);
  assert.doesNotMatch(fb, /grade|score|mark/i);
});
