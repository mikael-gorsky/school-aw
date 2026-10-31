// @reviewer: checks the structure and history of a public GitHub repository.
// It never grades; the teacher grades the work itself (specification 4.5).
import { config } from './config.js';

const REPO_RE = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

export function parseRepo(url) {
  const m = String(url || '').trim().match(REPO_RE);
  return m ? { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` } : null;
}

async function gh(path) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'school-of-agentic-work' };
  if (config.githubToken) headers.authorization = `Bearer ${config.githubToken}`;
  const r = await fetch(`https://api.github.com${path}`, { headers });
  let body = null;
  try { body = await r.json(); } catch { /* empty body */ }
  return { status: r.status, ok: r.ok, body };
}

const SHORT_MSG = /^(fix(es|ed)?|update[sd]?|wip|changes?|commit|test|tmp|temp|misc|stuff|asdf|\.+|-+|ok|done|save)$/i;

export function judgeCommits(commits) {
  const dates = commits.map(c => Date.parse(c.commit.author ? c.commit.author.date : c.commit.committer.date)).filter(Boolean);
  const days = new Set(dates.map(d => new Date(d).toISOString().slice(0, 10)));
  const span = dates.length ? (Math.max(...dates) - Math.min(...dates)) / 864e5 : 0;
  const weeks = Math.max(1, Math.round(span / 7));
  const n = commits.length >= 100 ? '100 or more' : String(commits.length);
  let spread;
  if (span >= 14 && days.size >= 5) spread = { state: 'ok', detail: `${n} commits on ${days.size} days over ${weeks} weeks.` };
  else if (span >= 3 || days.size >= 3) spread = { state: 'warn', detail: `${n} commits on ${days.size} days. Work along the course schedule spreads over several weeks.` };
  else spread = { state: 'bad', detail: `${n} commits on ${days.size} day${days.size === 1 ? '' : 's'}. A project built in 1 or 2 days does not follow the course schedule.` };

  const firstLines = commits.map(c => String(c.commit.message || '').split('\n')[0].trim());
  const short = firstLines.filter(m => m.split(/\s+/).filter(Boolean).length <= 1 || SHORT_MSG.test(m)).length;
  let messages;
  if (!commits.length) messages = { state: 'bad', detail: 'The repository has no commits.' };
  else if (short === 0) messages = { state: 'ok', detail: '' };
  else if (short / commits.length <= 0.25) messages = { state: 'warn', detail: `${short} of ${n} messages are a single word, such as "fix" or "update".` };
  else messages = { state: 'bad', detail: `${short} of ${n} messages are a single word, such as "fix" or "update".` };
  return { spread, messages };
}

export function judgeTree(paths) {
  const lower = paths.map(p => p.toLowerCase());
  const context = lower.some(p => ['claude.md', 'agents.md', '.claude/claude.md'].includes(p));
  const tests = lower.some(p => /(^|\/)(tests?|__tests__|spec)\//.test(p) || /\.(test|spec)\.[a-z0-9]+$/.test(p) || /(^|\/)test_[^/]+\.py$/.test(p) || /_test\.(go|py)$/.test(p));
  const record = lower.some(p => /(^|\/)(sessions?|agent[-_]?logs?|conversations?|transcripts?|history)(\/|\.md$)/.test(p) || /(^|\/)[^/]*session[^/]*\.md$/.test(p));
  return { context, tests, record };
}

export function feedbackFrom(results) {
  const fix = {
    public: 'Make the repository public. Only code in a public repository is graded.',
    context: 'Add a context file, such as CLAUDE.md, in the root folder and keep it up to date.',
    spread: 'Commit as you work along the course schedule, so that the history shows the work over several weeks.',
    messages: 'Write each commit message as a short sentence about the change, so that a reader of the history can follow your decisions.',
    tests: 'Add tests and ask the agent to run them before each commit.',
    record: 'Keep a record of your sessions with the agent in the repository, for example in docs/sessions/.',
    readme: 'Explain in the README how to install and run the project.',
  };
  const good = results.filter(r => r.state === 'ok').map(r => r.key);
  const parts = [];
  if (good.includes('public') && good.includes('context')) parts.push('Your repository is public and the context file is in place.');
  else if (good.includes('public')) parts.push('Your repository is public.');
  for (const r of results) if (r.state === 'bad' || r.state === 'warn') parts.push(fix[r.key]);
  if (parts.length === 1 && !results.some(r => r.state === 'bad' || r.state === 'warn')) parts.push('Every check passed. Keep working along the course schedule.');
  return parts.join(' ');
}

export async function checkRepository(url) {
  const ref = parseRepo(url);
  if (!ref) return { error: 'Use the address of a GitHub repository, such as https://github.com/name/project.' };
  const results = [];
  const add = (key, title, state, detail = '') => results.push({ key, title, state, detail });
  let meta;
  try { meta = await gh(`/repos/${ref.owner}/${ref.repo}`); } catch { return { error: 'The site could not reach GitHub. Try the check again later.' }; }
  if (meta.status === 403 || meta.status === 429) return { error: 'GitHub refused the request because of its limit on requests. Try the check again in an hour.' };
  // GitHub answers 404 for a private repository and for one that does not exist.
  if (!meta.ok && meta.status !== 404) return { error: `GitHub did not answer as expected (status ${meta.status}). Try the check again later.` };
  if (!meta.ok || meta.body.private) {
    add('public', 'The repository is public.', 'bad', 'GitHub does not show this repository to the public. Check the address, and make the repository public.');
    for (const [k, t] of [['context', 'A context file, CLAUDE.md, is in the root folder.'], ['spread', 'The work is spread over time.'], ['messages', 'Commit messages say what changed.'], ['tests', 'Tests exist.'], ['record', 'A record of the work with the agent is kept in the repository.'], ['readme', 'The README explains how to run the project.']]) {
      add(k, t, 'skip', 'Not checked, because the repository is not public.');
    }
    return { ref, results, feedback: feedbackFrom(results) };
  }
  add('public', 'The repository is public.', 'ok');
  const branch = meta.body.default_branch;
  let tree, commits, readme;
  try {
    [tree, commits, readme] = await Promise.all([
      gh(`/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`),
      gh(`/repos/${ref.owner}/${ref.repo}/commits?per_page=100`),
      gh(`/repos/${ref.owner}/${ref.repo}/readme`),
    ]);
  } catch { return { error: 'The site could not reach GitHub. Try the check again later.' }; }
  const paths = tree.ok && tree.body.tree ? tree.body.tree.filter(t => t.type === 'blob').map(t => t.path) : [];
  const t = judgeTree(paths);
  add('context', 'A context file, CLAUDE.md, is in the root folder.', t.context ? 'ok' : 'bad', t.context ? '' : 'No CLAUDE.md or AGENTS.md was found in the root folder.');
  const c = judgeCommits(commits.ok && Array.isArray(commits.body) ? commits.body : []);
  add('spread', 'The work is spread over time.', c.spread.state, c.spread.detail);
  add('messages', 'Commit messages say what changed.', c.messages.state, c.messages.detail);
  add('tests', 'Tests exist.', t.tests ? 'ok' : 'bad', t.tests ? '' : 'No test files or test folder were found.');
  add('record', 'A record of the work with the agent is kept in the repository.', t.record ? 'ok' : 'warn', t.record ? '' : 'No file that records the work with the agent was found, such as docs/sessions/ or AGENT_LOG.md.');
  let readmeText = '';
  if (readme.ok && readme.body && readme.body.content) readmeText = Buffer.from(readme.body.content, 'base64').toString('utf8');
  if (!readme.ok) add('readme', 'The README explains how to run the project.', 'bad', 'The repository has no README.');
  else if (/\b(install|run|start|setup|set up|usage|getting started)\b/i.test(readmeText)) add('readme', 'The README explains how to run the project.', 'ok');
  else add('readme', 'The README explains how to run the project.', 'warn', 'The README does not say how to install or run the project.');
  return { ref, results, feedback: feedbackFrom(results) };
}
