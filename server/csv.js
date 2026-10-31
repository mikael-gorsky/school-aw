// Reads a list of permitted addresses from a CSV file, such as a Moodle export.
// Only 5 columns are read: first name, last name, email, group and institution.
// Every other column, including any ID number, is dropped here and never reaches
// the database (decisions of 27 and 31 October 2026).

const EMAIL = /^[^\s@,;"]+@[^\s@,;"]+\.[^\s@,;"]+$/;

// Splits one CSV line, honoring quotes. The delimiter is guessed per file.
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

// Finds a column by its header. Where the file has both a plain and an English
// column, as a Moodle export with names in 2 languages does, the English one wins.
function column(header, re, not) {
  const hits = header.map((h, i) => [h, i]).filter(([h]) => re.test(h) && !(not && not.test(h)));
  const en = hits.find(([h]) => /\(en\)|\ben\b|english/.test(h));
  return (en || hits[0] || [null, -1])[1];
}

// A Moodle "Groups" cell may hold several groups separated by commas, such as
// "קבוצה 62121-1, קבוצה 662121-1". The first one is taken, and only its number
// when it has one.
function groupOf(cell) {
  const part = String(cell || '').split(',')[0].trim();
  const m = part.match(/\d[\w-]*/);
  return (m ? m[0] : part).slice(0, 40);
}

// Returns [{ email, group, institution, first, last }]. A field is '' when the
// file has no such column; a missing name is later taken from Google.
export function readPermitCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const d = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const header = splitLine(first, d).map(h => h.toLowerCase());
  const ei = column(header, /e-?mail/);
  let body = lines.slice(1);
  let gi = column(header, /group/, /e-?mail/);
  let ii = column(header, /institution|college|university/);
  let fi = column(header, /first ?name|given/);
  let li = column(header, /last ?name|family|surname/);
  if (ei < 0) {
    // No header row: take the first cell that looks like an address, and nothing else.
    body = lines; gi = ii = fi = li = -1;
  }
  const cell = (cells, i, max) => (i >= 0 ? String(cells[i] || '').trim().slice(0, max) : '');
  const out = [];
  const seen = new Set();
  for (const line of body) {
    const cells = splitLine(line, d);
    const email = (ei >= 0 ? cells[ei] : cells.find(isEmail) || '').trim().toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, group: gi >= 0 ? groupOf(cells[gi]) : '', institution: cell(cells, ii, 120), first: cell(cells, fi, 80), last: cell(cells, li, 80) });
  }
  return out;
}

// Writes the rows back as CSV, so that the browser sends the server only these
// 5 columns of the teacher's file.
export function writePermitCsv(rows) {
  const q = v => `"${String(v || '').replace(/"/g, '""')}"`;
  return ['email,group,institution,first name,last name', ...rows.map(r => [r.email, r.group, r.institution, r.first, r.last].map(q).join(','))].join('\n');
}

// Reads the plain list typed into the form: one address per line, or several
// separated by commas, semicolons or spaces.
export function readPermitList(text) {
  return [...new Set(String(text || '').split(/[\s,;]+/).map(s => s.trim().toLowerCase()).filter(isEmail))];
}
