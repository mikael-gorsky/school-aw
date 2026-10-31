// Programme content lives in content/<programme>/ as plain files, so the teacher
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

export function partOf(id, n) {
  const p = programme(id);
  return p ? p.parts.find(x => n >= x.from && n <= x.to) : null;
}

// Modules that have a study page with practice exercises.
export function modulesWithContent(id) {
  const p = programme(id);
  return p ? p.modules.filter(m => moduleContent(id, m.n)).map(m => m.n) : [];
}
