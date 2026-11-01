// Writes the semester schedule of a program into the lessons of its groups:
// npm run import-schedule [program], ase by default. It can run again after the
// schedule changes; lessons keep their answers and state.
import { initDb } from '../server/db.js';
import { importSchedule } from '../server/schedule.js';

initDb();
const id = process.argv[2] || 'ase';
const r = importSchedule(id);
console.log(`The schedule of ${id} is in: ${r.lessons} lessons in ${r.groups} groups.`);
