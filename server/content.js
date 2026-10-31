// Program content lives in content/<program>/ as plain files, so the teacher
// can review and change it in Git without touching code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const cache = new Map();

function readJson(file) {
  if (!cache.has(file)) {
    cache.set(file, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
  }
  return cache.get(file);
}

export function programme(id = 'ase') {
  return readJson(path.join(ROOT, id, 'programme.json'));
}

// A program without a final exam sets "exam": false. Its students and the
// teacher then never see Exam finale or readiness for an exam
// (decision of 31 October 2026: ASE is graded without an exam).
export function hasExam(id = 'ase') {
  const p = programme(id);
  return Boolean(p) && p.exam !== false;
}

export function moduleContent(id, n) {
  return readJson(path.join(ROOT, id, `module-${String(n).padStart(2, '0')}.json`));
}

export function lessonItems(id, moduleNo) {
  const all = readJson(path.join(ROOT, id, 'lessons.json')) || {};
  return all[String(moduleNo)] || [];
}

export function rulesText(id = 'ase') {
  const f = path.join(ROOT, id, 'rules.md');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
}

export function moduleTitle(id, n) {
  const p = programme(id);
  const m = p && p.modules.find(x => x.n === n);
  return m ? m.title : `Module ${n}`;
}

export function lessonModules(l) {
  try { const m = l.modules ? JSON.parse(l.modules) : null; if (Array.isArray(m) && m.length) return m; } catch { /* fall back */ }
  return [l.module];
}

// A lesson covers 1 or more modules, chosen by the teacher when the lesson is
// added: how modules are grouped into lessons is a decision for each semester,
// not part of the program (decision of 31 October 2026).
export function lessonTitle(id, l) {
  return lessonModules(l).map(n => moduleTitle(id, n)).join(' · ');
}
export const lessonModulesLabel = l => { const ms = lessonModules(l); return ms.length > 1 ? `modules ${ms.slice(0, -1).join(', ')} and ${ms[ms.length - 1]}` : `module ${ms[0]}`; };

export function partOf(id, n) {
  const p = programme(id);
  return p ? p.parts.find(x => n >= x.from && n <= x.to) : null;
}

// Modules that have a study page with practice exercises.
export function modulesWithContent(id) {
  const p = programme(id);
  return p ? p.modules.filter(m => moduleContent(id, m.n)).map(m => m.n) : [];
}
