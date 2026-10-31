// Starts the site on a free port with an empty database in memory.
// The settings are set before any server module is loaded, because
// server/config.js reads them once.
process.env.TEACHER_EMAILS = 'teacher@example.com';
process.env.DEMO_PASSWORD = 'demo-password';
process.env.DEV_LOGIN = '1';
process.env.SESSION_SECRET = 'test-secret';
process.env.SAW_LOG = '0';
process.env.ANTHROPIC_API_KEY = 'test-key';

const http = await import('node:http');
const db = await import('../server/db.js');
db.initDb(':memory:');
const demo = await import('../server/demo.js');
demo.ensureDemo();
const { handle } = await import('../server/app.js');

const server = http.createServer(handle);
await new Promise(r => server.listen(0, '127.0.0.1', r));
export const base = `http://127.0.0.1:${server.address().port}`;
export const stop = () => new Promise(r => { server.closeAllConnections(); server.close(r); });
export { db, demo };

const realFetch = globalThis.fetch.bind(globalThis);
export { realFetch };

// One request. Cookies are kept in the jar object passed in.
export async function req(method, path, { jar, form, json, headers = {} } = {}) {
  const h = { ...headers };
  if (jar && jar.cookie) h.cookie = jar.cookie;
  let body;
  if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json) { h['content-type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await realFetch(base + path, { method, headers: h, body, redirect: 'manual' });
  const set = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  for (const c of set) {
    const [pair] = c.split(';');
    const [name, value] = pair.split('=');
    if (jar && name === 'saw_session') jar.cookie = value ? `saw_session=${value}` : '';
  }
  const text = await r.text();
  return { status: r.status, location: r.headers.get('location'), text, json: () => JSON.parse(text) };
}

export async function signInDev(email) {
  const jar = {};
  const r = await req('POST', '/auth/dev', { jar, form: { email, intent: 'register' } });
  return { jar, r };
}

export async function signInDemo(password = 'demo-password') {
  const jar = {};
  const r = await req('POST', '/auth/demo', { jar, form: { login: 'demo', password } });
  return { jar, r };
}
