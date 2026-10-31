// Calls to the Claude API for @tutor and for grouping comments into themes.
// No name or email address is ever sent (specification 7).
import { config } from './config.js';
import { programme, rulesText } from './content.js';
import { setting } from './db.js';

async function claude(system, user, maxTokens = 700) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: config.tutorModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Claude API answered ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

export const aiAvailable = () => Boolean(config.anthropicKey);

export async function askTutor(question, programmeId) {
  const p = programme(programmeId);
  const extra = setting(`tutor_answers:${programmeId}`, '');
  const system = [
    'You are @tutor, the self-study agent of School of Agentic Work. You answer students\' questions about the course rules, the lessons and the site.',
    'Answer only from the text below. Do not invent dates, weights or rules. Do not write project code for the student, and do not discuss grades of any person.',
    'Write in plain English, in full sentences, with digits for numbers. Keep the answer under 120 words.',
    'If the text does not contain the answer, reply with the single word PASS and nothing else.',
    'Otherwise end with a separate line in the form "Source: <heading of the section you used>".',
    '',
    `Programme: ${p.title}`,
    p.description.join(' '),
    'Modules: ' + p.modules.map(m => `${m.n}. ${m.title}: ${m.summary}`).join(' '),
    '',
    rulesText(programmeId),
    extra ? `\n## Answers added by the teacher\n\n${extra}` : '',
  ].join('\n');
  const text = await claude(system, String(question).slice(0, 1500));
  if (/^PASS\b/.test(text)) return { passed: true };
  const m = text.match(/\n\s*Source:\s*(.+)\s*$/i);
  return { answer: m ? text.slice(0, m.index).trim() : text, source: m ? m[1].trim() : '' };
}

// Groups written comments into themes. The comments carry no names.
export async function groupThemes(comments) {
  const system = 'You group anonymous student comments about a course into themes. Reply with JSON only: an array of at most 6 objects with the keys "theme" (a short sentence in plain English), "count" (number of comments), "tone" ("positive", "negative" or "request") and "example" (one comment quoted exactly). Order by count, largest first.';
  const text = await claude(system, comments.map((c, i) => `${i + 1}. ${c}`).join('\n'), 1200);
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  return JSON.parse(json);
}

