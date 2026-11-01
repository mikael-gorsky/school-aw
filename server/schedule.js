// The semester schedule: the date, time and content of every meeting of each
// group, imported from the teacher's schedule (decision of 1 November 2026).
// The site and the Teaching Assistant read the date in Israel time, so that
// "today's class" means the same day for the student and the teacher.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, run, log } from './db.js';
import { addLesson, lessonItemsFor, lessonsOf } from './model.js';
import { lessonModules, lessonTitle } from './content.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
export const TZ = 'Asia/Jerusalem';

export function scheduleFile(progId) {
  const f = path.join(ROOT, progId, 'schedule.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// Minutes that Israel time is ahead of UTC at a moment (120 or 180).
function offsetAt(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - ms) / 60e3;
}
// A wall-clock date and time in Israel, as an ISO time in UTC.
export function israelToIso(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  return new Date(guess - offsetAt(guess - offsetAt(guess) * 60e3) * 60e3).toISOString();
}
// The day in Israel, as YYYY-MM-DD.
export const israelDay = (t = new Date()) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });

// Writes the schedule into the lessons of each group. A lesson that already
// exists keeps its state, its answers and its Zoom link; it gets the new date,
// time and note, and new exercises only if its modules changed and nobody has
// answered yet.
export function importSchedule(progId, sched = scheduleFile(progId)) {
  if (!sched) return { groups: 0, lessons: 0 };
  let groups = 0, lessons = 0;
  for (const gs of sched.groups) {
    const g = get('SELECT * FROM groups WHERE code = ? AND programme = ? AND is_demo = 0', gs.code, progId);
    if (!g) continue;
    groups++;
    gs.dates.forEach((date, i) => {
      const plan = sched.lessons.find(l => l.n === i + 1);
      if (!plan) return;
      const startsAt = israelToIso(date, gs.from), endsAt = israelToIso(date, gs.to);
      const note = plan.note || null;
      const old = get('SELECT * FROM lessons WHERE group_id = ? AND number = ?', g.id, plan.n);
      if (!old) {
        addLesson(g.id, plan.n, plan.modules, startsAt, null, { endsAt, note });
      } else {
        run('UPDATE lessons SET starts_at = ?, ends_at = ?, note = ? WHERE id = ?', startsAt, endsAt, note, old.id);
        if (JSON.stringify(lessonModules(old)) !== JSON.stringify(plan.modules)) {
          const answered = get('SELECT 1 FROM answers a JOIN items i ON i.id = a.item_id WHERE i.lesson_id = ? LIMIT 1', old.id);
          if (!answered) {
            run('UPDATE lessons SET module = ?, modules = ? WHERE id = ?', plan.modules[0] || 0, JSON.stringify(plan.modules), old.id);
            run('DELETE FROM items WHERE lesson_id = ?', old.id);
            lessonItemsFor(progId, plan.modules).forEach((it, k) => run('INSERT INTO items(lesson_id, seq, label, question, options, correct) VALUES(?, ?, ?, ?, ?, ?)',
              old.id, k + 1, it.label, it.question, JSON.stringify(it.options), it.correct));
          }
        }
      }
      lessons++;
    });
  }
  log('registrar', `imported the ${sched.term || ''} schedule: ${lessons} lessons in ${groups} groups`.replace('  ', ' '));
  return { groups, lessons };
}

// Where a lesson stands on a given moment: held, live, today or coming.
export function lessonPhase(l, t = new Date()) {
  if (l.state === 'live') return 'live';
  if (l.state === 'ended') return 'held';
  if (!l.starts_at) return 'coming';
  const end = l.ends_at ? Date.parse(l.ends_at) : Date.parse(`${l.starts_at.slice(0, 10)}T23:59:59.999Z`);
  if (end < +t) return 'held';
  return israelDay(l.starts_at) === israelDay(t) ? 'today' : 'coming';
}

const fmt = (iso, o) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, ...o });
export const dayLabel = iso => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const timeLabel = iso => fmt(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// The text the Teaching Assistant gets with each question: today's date and
// the schedule of the student's group, by group code only. It holds no name,
// no address and nothing else about the student.
export function scheduleContext(group, t = new Date()) {
  const lines = [`Today is ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}, Israel time.`];
  if (!group) return lines.join('\n');
  const ls = lessonsOf(group.id);
  if (!ls.length) {
    lines.push('The schedule of the student\'s group is not on the site yet.');
    return lines.join('\n');
  }
  lines.push('', `# The schedule of the student's group (${group.is_demo ? 'the demo group, a sample' : `group ${group.code}, ${group.institution}`})`);
  for (const l of ls) {
    const when = l.starts_at ? `${dayLabel(l.starts_at)}, ${timeLabel(l.starts_at)}${l.ends_at ? `–${timeLabel(l.ends_at)}` : ''}` : 'date not set';
    const mods = lessonModules(l);
    lines.push(`- Lesson ${l.number}, ${when} [${lessonPhase(l, t)}]: ${lessonTitle(group.programme, l) || 'no content set'}${mods.length ? ` (module${mods.length > 1 ? 's' : ''} ${mods.join(' and ')})` : ''}`);
  }
  const sched = scheduleFile(group.programme);
  if (sched && sched.breaks && !group.is_demo) lines.push('', ...sched.breaks);
  return lines.join('\n');
}
