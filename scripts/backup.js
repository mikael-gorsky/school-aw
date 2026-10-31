// Writes a copy of the database to backups/: npm run backup.
// VACUUM INTO makes a consistent copy while the site keeps running. The pod's
// workspace is not a backup, so copy the file out of the pod as well
// (docs/deployment-podway.md).
import fs from 'node:fs';
import path from 'node:path';
import { initDb, getDb } from '../server/db.js';

initDb();
const dir = path.resolve(process.env.BACKUP_DIR || './backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const file = path.join(dir, `saw-${stamp}.db`);
if (fs.existsSync(file)) fs.unlinkSync(file);
getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
console.log(`The database is copied to ${file}.`);
