// Builds the demo group again from its fixed seed: npm run seed-demo.
// The server does the same every night at 03:00 Israel time.
import { initDb } from '../server/db.js';
import { resetDemo, demoGroup } from '../server/demo.js';
import { all } from '../server/db.js';

initDb();
resetDemo();
const g = demoGroup();
const n = all("SELECT COUNT(*) AS n FROM users WHERE group_id = ? AND role IN ('demo','sample')", g.id)[0].n;
console.log(`The demo group "${g.institution} · group ${g.code}" is ready with ${n} members, including the demo login.`);
