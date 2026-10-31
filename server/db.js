// SQLite database through Node's built-in node:sqlite, so the site needs no
// native packages and installs in the pod without a build step.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups(
  id INTEGER PRIMARY KEY,
  institution TEXT NOT NULL,
  code TEXT NOT NULL,
  programme TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(institution, code, programme)
);
-- The list of permitted addresses. An address carries its group, and the group
-- carries the institution and programme (decision of 31 October 2026).
-- There is deliberately no column for an ID number.
CREATE TABLE IF NOT EXISTS permitted(
  email TEXT PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','teacher','demo','sample')),
  group_id INTEGER REFERENCES groups(id),
  registered_at TEXT NOT NULL,
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states(
  state TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refused(
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  at TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons(
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  module INTEGER NOT NULL,
  starts_at TEXT,
  zoom_url TEXT,
  state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','live','ended')),
  UNIQUE(group_id, number)
);
CREATE TABLE IF NOT EXISTS items(
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  label TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct TEXT,
  state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','open','closed','shown')),
  opened_at TEXT,
  closes_at TEXT
);
CREATE TABLE IF NOT EXISTS answers(
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY(item_id, user_id)
);
-- Ratings and survey answers carry no user id. The voter column is a one-way key
-- made from the user id and a server secret, so that a student can find their own
-- rating and cannot rate twice, while the teacher's pages never show a single
-- rating (decision of 29 October 2026).
CREATE TABLE IF NOT EXISTS lesson_ratings(
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  helped TEXT NOT NULL DEFAULT '[]',
  blocked TEXT NOT NULL DEFAULT '[]',
  comment TEXT,
  at TEXT NOT NULL,
  UNIQUE(lesson_id, voter)
);
CREATE TABLE IF NOT EXISTS module_ratings(
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  module INTEGER NOT NULL,
  voter TEXT NOT NULL,
  clarity INTEGER NOT NULL CHECK(clarity BETWEEN 1 AND 5),
  at TEXT NOT NULL,
  UNIQUE(group_id, module, voter)
);
CREATE TABLE IF NOT EXISTS surveys(
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
  opened_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS survey_answers(
  id INTEGER PRIMARY KEY,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  overall INTEGER, clarity INTEGER, pace INTEGER, usefulness INTEGER,
  interest INTEGER, support INTEGER, workload INTEGER, recommend INTEGER,
  at TEXT NOT NULL,
  UNIQUE(survey_id, voter)
);
CREATE TABLE IF NOT EXISTS practice(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module INTEGER NOT NULL,
  exercise TEXT NOT NULL,
  answer TEXT NOT NULL,
  correct INTEGER,
  at TEXT NOT NULL,
  PRIMARY KEY(user_id, module, exercise)
);
CREATE TABLE IF NOT EXISTS projects(
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('own','tribunal')),
  repo TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(user_id, kind)
);
CREATE TABLE IF NOT EXISTS checks(
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  results TEXT NOT NULL,
  passed INTEGER NOT NULL, warnings INTEGER NOT NULL, failed INTEGER NOT NULL,
  feedback TEXT
);
CREATE TABLE IF NOT EXISTS tutor_usage(
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, day)
);
-- Questions the tutor could not answer from the rules. Stored without the asker.
CREATE TABLE IF NOT EXISTS tutor_passed(
  id INTEGER PRIMARY KEY,
  programme TEXT NOT NULL,
  question TEXT NOT NULL,
  at TEXT NOT NULL,
  answer TEXT,
  handled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY,
  name TEXT, email TEXT, topic TEXT,
  body TEXT NOT NULL,
  at TEXT NOT NULL,
  handled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS agent_log(
  id INTEGER PRIMARY KEY,
  agent TEXT NOT NULL,
  text TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_visits(
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  at TEXT NOT NULL
);
`;

export function initDb(file) {
  const target = file || path.join(config.dataDir, 'saw.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON;');
  if (target !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrate();
  return db;
}

// Columns added after the first version. CREATE TABLE IF NOT EXISTS does not add
// columns to a table that already exists, so they are added here once.
// Names and the photo come from Google, and the comment is written by the user
// (decision of 31 October 2026).
function migrate() {
  const have = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  for (const col of ['first_name', 'last_name', 'comment']) {
    if (!have.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
  }
  // The teacher may give the English names of students on the list, which the
  // student then sees at registration (decision of 31 October 2026).
  const havePermit = new Set(db.prepare('PRAGMA table_info(permitted)').all().map(c => c.name));
  for (const col of ['first_name', 'last_name']) {
    if (!havePermit.has(col)) db.exec(`ALTER TABLE permitted ADD COLUMN ${col} TEXT`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS user_photos(
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    data BLOB NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

export function getDb() {
  if (!db) throw new Error('Database is not initialised');
  return db;
}

export const now = () => new Date().toISOString();
export const all = (sql, ...p) => getDb().prepare(sql).all(...p);
export const get = (sql, ...p) => getDb().prepare(sql).get(...p);
export const run = (sql, ...p) => getDb().prepare(sql).run(...p);

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try { const r = fn(); d.exec('COMMIT'); return r; }
  catch (e) { d.exec('ROLLBACK'); throw e; }
}

// One-way key for anonymous ratings: the same user and scope always give the
// same key, but the key cannot be turned back into the user id without the secret.
export function voterKey(userId, scope) {
  return crypto.createHmac('sha256', config.sessionSecret).update(`${userId}:${scope}`).digest('hex');
}

export function setting(key, fallback = '') {
  const r = get('SELECT value FROM settings WHERE key = ?', key);
  return r ? r.value : fallback;
}
export function setSetting(key, value) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
}

export function log(agent, text) {
  run('INSERT INTO agent_log(agent, text, at) VALUES(?, ?, ?)', agent, text, now());
}
