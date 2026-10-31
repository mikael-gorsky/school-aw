// Starts the site: opens the database, makes sure the demo group exists, and
// listens on the port of the pod's preview (docs/deployment-podway.md).
import http from 'node:http';
import { config } from './config.js';
import { initDb } from './db.js';
import { handle } from './app.js';
import { ensureDemo, nightlyCheck } from './demo.js';

initDb();
ensureDemo();
nightlyCheck();
// The demo group is reset every night at 03:00 Israel time (decision of 31 October 2026).
setInterval(() => { try { nightlyCheck(); } catch (e) { console.error(`Nightly demo reset failed: ${e.message}`); } }, 60e3).unref();

if (!config.sessionSecretIsSet) console.warn('SESSION_SECRET is not set. Sessions end on every restart, and students could rate a lesson again. Add it in the Secrets panel.');
if (!config.teacherEmails.length) console.warn('TEACHER_EMAILS is not set. Nobody can sign in as the teacher.');
if (config.devLogin) console.warn('DEV_LOGIN is set. Anyone can sign in as any address. Never set it in the pod.');

const server = http.createServer(handle);
server.listen(config.port, config.host, () => {
  console.log(`School of Agentic Work is listening on ${config.host}:${config.port} (${config.baseUrl})`);
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
