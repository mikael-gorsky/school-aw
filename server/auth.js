// Sessions, Google sign-in, the demo login and registration against the list of
// permitted addresses (decisions of 31 October 2026).
import crypto from 'node:crypto';
import { config, googleConfigured } from './config.js';
import { get, run, now, log } from './db.js';

const SESSION_DAYS = 30;
export const COOKIE = 'saw_session';

export function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  run('INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)', token, userId, now(), exp);
  return token;
}

export function sessionUser(token) {
  if (!token) return null;
  const row = get(`SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`, token);
  if (!row) return null;
  if (row.expires_at < now()) { run('DELETE FROM sessions WHERE token = ?', token); return null; }
  run('UPDATE users SET last_seen = ? WHERE id = ?', now(), row.id);
  return row;
}

export function endSession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

function groupLabel(g) {
  return g ? `${g.institution} · group ${g.code}` : '';
}

// Decides whether an address may enter, and as whom.
// Returns { user, isNew } or { refused: true }.
export function admit(rawEmail) {
  const email = normEmail(rawEmail);
  if (!email || !email.includes('@')) return { refused: true };

  if (config.teacherEmails.includes(email)) {
    let user = get('SELECT * FROM users WHERE email = ?', email);
    if (!user) {
      run("INSERT INTO users(email, role, registered_at) VALUES(?, 'teacher', ?)", email, now());
      user = get('SELECT * FROM users WHERE email = ?', email);
    } else if (user.role !== 'teacher') {
      run("UPDATE users SET role = 'teacher' WHERE id = ?", user.id);
      user = get('SELECT * FROM users WHERE id = ?', user.id);
    }
    return { user, isNew: false };
  }

  // A student enters only while the address is on the list. The group comes
  // from the list, so the student never enters an institution or group.
  const perm = get('SELECT * FROM permitted WHERE email = ?', email);
  const existing = get('SELECT * FROM users WHERE email = ?', email);
  if (existing && (existing.role === 'demo' || existing.role === 'sample')) return { refused: true };
  if (!perm) {
    run('INSERT INTO refused(email, at) VALUES(?, ?)', email, now());
    log('registrar', 'refused a registration from an address that is not on any list');
    return { refused: true };
  }
  const group = get('SELECT * FROM groups WHERE id = ?', perm.group_id);
  if (existing) {
    if (existing.group_id !== perm.group_id) run('UPDATE users SET group_id = ? WHERE id = ?', perm.group_id, existing.id);
    return { user: get('SELECT * FROM users WHERE id = ?', existing.id), isNew: false, group };
  }
  run("INSERT INTO users(email, role, group_id, registered_at) VALUES(?, 'student', ?, ?)", email, perm.group_id, now());
  log('registrar', `registered a student of ${groupLabel(group)}`);
  return { user: get('SELECT * FROM users WHERE email = ?', email), isNew: true, group };
}

export function demoLogin(login, password) {
  if (!config.demoPassword) return null;
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(config.demoPassword);
  const ok = String(login || '').trim().toLowerCase() === 'demo' && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return null;
  return get("SELECT * FROM users WHERE role = 'demo' AND email = 'demo'") || null;
}

// Google sign-in, OpenID Connect authorisation code flow.
export function googleStart(intent) {
  if (!googleConfigured()) return null;
  const state = crypto.randomBytes(24).toString('base64url');
  run('INSERT INTO oauth_states(state, intent, created_at) VALUES(?, ?, ?)', state, intent === 'register' ? 'register' : 'signin', now());
  const p = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${config.baseUrl}/auth/google/callback`,
    response_type: 'code',
    // "profile" gives the name and photo shown on My account (decision of 31 October 2026).
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function googleFinish(query) {
  const row = get('SELECT * FROM oauth_states WHERE state = ?', String(query.state || ''));
  run("DELETE FROM oauth_states WHERE state = ? OR created_at < ?", String(query.state || ''), new Date(Date.now() - 6e5).toISOString());
  if (!row || row.created_at < new Date(Date.now() - 6e5).toISOString()) throw new Error('The sign-in request expired. Please try again.');
  if (!query.code) throw new Error('Google did not return a sign-in code.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(query.code),
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: `${config.baseUrl}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Google refused the sign-in code.');
  const tok = await res.json();
  // The ID token comes straight from Google's token endpoint over TLS, so its
  // claims can be read without verifying the signature (OpenID Connect 3.1.3.7).
  const payload = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString());
  const issOk = payload.iss === 'https://accounts.google.com' || payload.iss === 'accounts.google.com';
  if (!issOk || payload.aud !== config.google.clientId || !payload.email || payload.email_verified === false) {
    throw new Error('Google did not confirm the email address.');
  }
  return {
    email: normEmail(payload.email), intent: row.intent,
    profile: { first: payload.given_name || '', last: payload.family_name || '', picture: payload.picture || '' },
  };
}

// Names from Google fill only empty fields, so a name the user corrected on
// My account stays. The photo is copied at every sign-in and served by the
// site itself, because Google's photo addresses can change.
export async function applyProfile(userId, profile) {
  if (!profile) return;
  const clip = v => String(v || '').trim().slice(0, 80) || null;
  run('UPDATE users SET first_name = COALESCE(first_name, ?), last_name = COALESCE(last_name, ?) WHERE id = ?', clip(profile.first), clip(profile.last), userId);
  const photo = await fetchPhoto(profile.picture);
  if (photo) {
    run(`INSERT INTO user_photos(user_id, type, data, updated_at) VALUES(?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET type = excluded.type, data = excluded.data, updated_at = excluded.updated_at`, userId, photo.type, photo.data, now());
  }
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function fetchPhoto(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.googleusercontent.com')) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !PHOTO_TYPES.includes(type)) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    return data.length && data.length <= 300e3 ? { type, data } : null;
  } catch {
    return null;
  }
}

export const displayName = u => (u ? u.last_name || u.first_name || (u.role === 'demo' ? 'demo' : u.email.split('@')[0]) : '');
