// The helper: the round button with the teacher's photo that answers a
// student's questions about the site and the course (decision of 31 October 2026).
// It runs on Claude Sonnet with the site guide, the course and the whole
// textbook in a cached system prompt. No name or email address is ever sent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { programme, rulesText, moduleContent } from './content.js';
import { recordSpend } from './spend.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
export const HELPER_DAILY = 20;
const MAX_TURNS = 12, MAX_CHARS = 3000;

// The textbook is the teacher's own book. The repository is public, so the
// book is kept in the data folder of the pod and never committed.
export function textbookPath(id) {
  return path.join(config.dataDir, `textbook-${id}.txt`);
}

const cache = new Map();
function courseText(id) {
  if (cache.has(id)) return cache.get(id);
  const p = programme(id);
  const mods = p.modules.map(m => {
    const mc = moduleContent(id, m.n);
    if (!mc) return `### Module ${m.n}: ${m.title}\n${m.summary}`;
    return [`### Module ${m.n}: ${m.title}`, mc.intro, mc.reading ? `Reading: ${mc.reading}` : '',
      ...mc.ideas.map(i => `- ${i.title}: ${i.text}`)].filter(Boolean).join('\n');
  }).join('\n\n');
  const text = [
    `# The program: ${p.title}`,
    ...(p.description || []),
    p.outcomes ? `## What students will be able to do\n${p.outcomes.map(o => `- ${o}`).join('\n')}` : '',
    `## Parts\n${p.parts.map(x => `- Part ${x.n}, ${x.title} (modules ${x.from} to ${x.to}): ${x.text}`).join('\n')}`,
    `## Modules and their study pages\n${mods}`,
    `## Rules of the program\n${rulesText(id)}`,
  ].filter(Boolean).join('\n\n');
  cache.set(id, text);
  return text;
}

function bookText(id) {
  const key = `book:${id}`;
  if (!cache.has(key)) {
    const f = textbookPath(id);
    cache.set(key, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  }
  return cache.get(key);
}

const INSTRUCTIONS = `You are the helper of School of Agentic Work (SAW), shown as a round button with the teacher's photo. A student opens you to ask about the site, about their course, or about the ideas of the course and its textbook.

How you answer:
- Answer in the language the student writes in. If they write in Hebrew, answer in Hebrew; in Russian, in Russian; and so on. Write English in American spelling.
- Be attentive to what the student actually asks, and to what lies behind the question. Explain in detail and in simple words, step by step where that helps, with a short example when an idea is abstract. Prefer short paragraphs and short lists over long blocks of text.
- Base your answers on the site guide, the course material and the textbook below. When you use the textbook, name the chapter. When the material does not settle a question about the course (a date, a grade, a deadline, an exception to a rule), say so plainly and suggest the student ask the teacher through Contact SAW. Never invent dates, weights, rules or decisions.
- You never grade, never say what grade a piece of work would get, and never decide anything about a person; those are the teacher's decisions.
- You may explain concepts and help a student think through their own project, but do not write the project's code for them: the course grades the discipline of directing an agent, and the student does that with their own tools.
- You do not know who the student is. Do not ask for their name, email or ID number.`;

export function systemBlocks(id) {
  const blocks = [
    { type: 'text', text: INSTRUCTIONS },
    { type: 'text', text: `# Site guide\n\n${fs.readFileSync(path.join(ROOT, 'saw-guide.md'), 'utf8')}` },
    { type: 'text', text: courseText(id) },
  ];
  const book = bookText(id);
  if (book) blocks.push({ type: 'text', text: `# The course textbook (full text)\n\n${book}` });
  // One cache breakpoint at the end of the stable prefix: the book alone is
  // about 200,000 tokens, and reading it from the cache costs a tenth of the
  // normal price. The 1-hour lifetime keeps it warm between lessons.
  blocks[blocks.length - 1].cache_control = { type: 'ephemeral', ttl: '1h' };
  return blocks;
}

// The conversation comes from the browser. Only roles and text are kept, the
// last turns only, and it must start with the student and alternate.
export function cleanTurns(turns) {
  const list = (Array.isArray(turns) ? turns : [])
    .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.trim())
    .map(t => ({ role: t.role, content: t.text.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_TURNS);
  while (list.length && list[0].role !== 'user') list.shift();
  const out = [];
  for (const t of list) {
    if (out.length && out[out.length - 1].role === t.role) out[out.length - 1].content += `\n\n${t.content}`;
    else out.push(t);
  }
  return out.length && out[out.length - 1].role === 'user' ? out : [];
}

export async function askHelper(id, turns) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
      // If a safety check declines a request, the API retries it on a fallback model.
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: config.helperModel,
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      fallbacks: 'default',
      system: systemBlocks(id),
      messages: turns,
    }),
    signal: AbortSignal.timeout(120e3),
  });
  if (!res.ok) throw new Error(`Claude API answered ${res.status}`);
  const data = await res.json();
  recordSpend(data.model || config.helperModel, data.usage);
  if (data.stop_reason === 'refusal') return { text: 'I cannot help with that question. Please ask your teacher through Contact SAW.' };
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return { text: text || 'I could not answer just now. Please try again.', usage: data.usage };
}
