// How long the site keeps students' data (decision of 20 November 2026).
// A group's course ends on the day of its last lesson. 4 months later the
// teacher emails the students that their data will be deleted, and marks the
// notice sent on Groups and access. 7 days after that the site deletes the
// group's personal data. Nothing is deleted before the teacher marks the
// notice sent. Ratings and survey answers stay, made fully anonymous, so the
// teacher keeps the figures about the course.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run, now, log, tx, getDb } from './db.js';

export const NOTICE_MONTHS = 4;
export const NOTICE_DAYS = 7;
export const REFUSED_DAYS = 30;
export const MESSAGE_MONTHS = 4;
export const BACKUP_DAYS = 30;
const DAY = 864e5;

const addMonths = (iso, n) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString(); };

// The dates of one group: when its course ends, when the notice is due, and
// when the data is deleted once the notice is sent.
export function retentionOf(group, t = Date.now()) {
  if (!group || group.is_demo) return null;
  const end = get('SELECT MAX(COALESCE(ends_at, starts_at)) AS at FROM lessons WHERE group_id = ?', group.id)?.at || null;
  const due = end ? addMonths(end, NOTICE_MONTHS) : null;
  const deleteAt = group.notice_sent_at ? new Date(Date.parse(group.notice_sent_at) + NOTICE_DAYS * DAY).toISOString() : null;
  return {
    courseEnd: end, noticeDue: due, noticeSent: group.notice_sent_at || null, deleteAt, purged: group.purged_at || null,
    canSend: Boolean(due && !group.notice_sent_at && !group.purged_at && Date.parse(due) <= t),
    overdue: Boolean(due && !group.notice_sent_at && !group.purged_at && Date.parse(due) + NOTICE_DAYS * DAY <= t),
  };
}

export function markNoticeSent(groupId) {
  const g = get('SELECT * FROM groups WHERE id = ? AND is_demo = 0', groupId);
  const r = retentionOf(g);
  if (!r || !r.canSend) return false;
  run('UPDATE groups SET notice_sent_at = ? WHERE id = ?', now(), g.id);
  log('steward', `will delete the data of group ${g.code} in ${NOTICE_DAYS} days, after the teacher's notice`);
  return true;
}

export function cancelNotice(groupId) {
  const g = get('SELECT * FROM groups WHERE id = ? AND is_demo = 0 AND purged_at IS NULL', groupId);
  if (!g || !g.notice_sent_at) return false;
  run('UPDATE groups SET notice_sent_at = NULL WHERE id = ?', g.id);
  log('steward', `stopped the deletion of the data of group ${g.code}`);
  return true;
}

// Deletes everything that names a student of the group. Lessons and their
// questions stay, because they hold nothing about a person.
export function purgeGroup(groupId) {
  const g = get('SELECT * FROM groups WHERE id = ? AND is_demo = 0', groupId);
  if (!g) return false;
  tx(() => {
    const emails = all("SELECT email FROM users WHERE group_id = ? AND role = 'student' UNION SELECT email FROM permitted WHERE group_id = ?", g.id, g.id).map(r => r.email);
    const ids = all("SELECT id FROM users WHERE group_id = ? AND role = 'student'", g.id).map(r => r.id);
    for (const id of ids) {
      run('DELETE FROM tutor_usage WHERE user_id = ?', id);
      run('DELETE FROM helper_usage WHERE who = ?', `user:${id}`);
    }
    // Answers, practice, projects, checks, photos and sessions go with the user.
    run("DELETE FROM users WHERE group_id = ? AND role = 'student'", g.id);
    run('DELETE FROM permitted WHERE group_id = ?', g.id);
    for (const e of emails) {
      run('DELETE FROM refused WHERE email = ? OR claimed = ?', e, e);
      run('DELETE FROM messages WHERE email = ?', e);
    }
    // The one-way key could still link a rating to a student while the server
    // secret exists, so it is replaced by a key that links to nobody.
    run("UPDATE lesson_ratings SET voter = 'gone:' || id WHERE lesson_id IN (SELECT id FROM lessons WHERE group_id = ?)", g.id);
    run("UPDATE module_ratings SET voter = 'gone:' || id WHERE group_id = ?", g.id);
    run("UPDATE survey_answers SET voter = 'gone:' || id WHERE survey_id IN (SELECT id FROM surveys WHERE group_id = ?)", g.id);
    run('UPDATE groups SET purged_at = ? WHERE id = ?', now(), g.id);
  });
  log('steward', `deleted the personal data of group ${g.code}, 4 months after its course and 7 days after the notice`);
  return true;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const backupDir = () => path.resolve(ROOT, process.env.BACKUP_DIR || 'backups');

// Old backups hold data that the site has since deleted, so they go too.
export function pruneBackups(dir = backupDir(), t = Date.now()) {
  let gone = 0;
  if (!fs.existsSync(dir)) return gone;
  for (const f of fs.readdirSync(dir)) {
    if (!/^saw-.*\.db$/.test(f)) continue;
    const p = path.join(dir, f);
    if (t - fs.statSync(p).mtimeMs > BACKUP_DAYS * DAY) { fs.unlinkSync(p); gone++; }
  }
  return gone;
}

// Runs every few minutes from main.js.
export function retentionCheck(t = Date.now()) {
  let purged = 0;
  for (const g of all('SELECT * FROM groups WHERE is_demo = 0 AND purged_at IS NULL AND notice_sent_at IS NOT NULL')) {
    const r = retentionOf(g, t);
    if (r.deleteAt && Date.parse(r.deleteAt) <= t) { purgeGroup(g.id); purged++; }
  }
  run('DELETE FROM refused WHERE at < ?', new Date(t - REFUSED_DAYS * DAY).toISOString());
  run('DELETE FROM messages WHERE at < ?', addMonths(new Date(t).toISOString(), -MESSAGE_MONTHS));
  // Deleted rows can stay readable in the free pages of the file until it is
  // rewritten.
  if (purged) getDb().exec('VACUUM');
  // Backups are judged by the real clock, never by a time given for a test.
  pruneBackups(backupDir());
  return purged;
}
