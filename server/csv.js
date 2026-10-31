// Reads a list of permitted addresses from a CSV file, such as a Moodle export.
// Only the email column and the group column are read. Every other column,
// including any ID number, is dropped here and never reaches the database
// (decision of 27 October 2026).

const EMAIL = /^[^\s@,;"]+@[^\s@,;"]+\.[^\s@,;"]+$/;

// Splits one CSV line, honouring quotes. The delimiter is guessed per file.
function splitLine(line, d) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function isEmail(s) {
  return EMAIL.test(String(s || '').trim());
}

// Returns [{ email, group }]. group is '' when the file has no group column.
// A Moodle "Groups" cell may hold several groups separated by commas; the first
// one is taken.
export function readPermitCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const d = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const header = splitLine(first, d).map(h => h.toLowerCase());
  let ei = header.findIndex(h => /e-?mail/.test(h));
  let gi = header.findIndex(h => /^groups?$|group/.test(h) && !/e-?mail/.test(h));
  let body = lines.slice(1);
  if (ei < 0) {
    // No header row: take the first cell that looks like an address, and no group.
    body = lines; gi = -1;
  }
  const out = [];
  const seen = new Set();
  for (const line of body) {
    const cells = splitLine(line, d);
    const email = (ei >= 0 ? cells[ei] : cells.find(isEmail) || '').trim().toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    const group = gi >= 0 ? String(cells[gi] || '').split(',')[0].trim().slice(0, 40) : '';
    out.push({ email, group });
  }
  return out;
}

// Reads the plain list typed into the form: one address per line, or several
// separated by commas, semicolons or spaces.
export function readPermitList(text) {
  return [...new Set(String(text || '').split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(isEmail))];
}
