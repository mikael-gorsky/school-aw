// The page layout and the small building blocks shared by all pages.
// Markup and class names follow mockup/index.html, the agreed design.
import { displayName } from './auth.js';
import { hasExam } from './content.js';
import { spendAlerts } from './spend.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');

function svg(p, w = 18) {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
export const I = {
  klass: svg('<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4M7 9h5M7 12h8"></path>'),
  study: svg('<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"></path><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"></path>'),
  projects: svg('<circle cx="6" cy="6" r="2"></circle><circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="8" r="2"></circle><path d="M6 8v8M18 10c0 4-6 3-10 7"></path>'),
  exam: svg('<path d="M5 21V4"></path><path d="M5 4h11l-2 4 2 4H5"></path>'),
  check: svg('<path d="M5 12l5 5 9-10"></path>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"></path>'),
  warn: svg('<path d="M12 4l9 16H3z"></path><path d="M12 10v4M12 17v.5"></path>'),
  dash: svg('<path d="M6 12h12"></path>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"></path>', 22),
  up: svg('<path d="M7 14l5-5 5 5"></path>', 14),
  down: svg('<path d="M7 10l5 5 5-5"></path>', 14),
  flat: svg('<path d="M6 12h12"></path>', 14),
  play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#3DDC97"></path></svg>',
};
const small = s => s.replace('width="18" height="18"', 'width="13" height="13"');

export function stat(kind, label) {
  const ic = { ok: I.check, warn: I.warn, bad: I.x, none: I.dash, skip: I.dash }[kind] || I.dash;
  return `<span class="chip ${kind === 'skip' ? 'none' : kind}">${small(ic)}${esc(label)}</span>`;
}
export const ag = id => `<a class="agent" href="/agents">@${id}</a>`;
export const agS = id => `<span class="agent">@${id}</span>`;

export function head(ey, title, sub, chips) {
  return `<div class="pagehead"><div><p class="eyebrow"><span class="p">$</span> ${ey}</p><h1 class="h1">${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}</div>${chips ? `<div class="chips">${chips}</div>` : ''}</div>`;
}
export function logLines(rows) {
  return rows.map(l => `<div class="l"><span class="a${l[2] ? ' h' : ''}">${l[2] ? esc(l[0]) : '@' + esc(l[0])}</span><span class="x">${esc(l[1])}</span></div>`).join('');
}
export function squares(n, of) {
  let h = `<span class="squares" aria-label="${n} of ${of} answered">`;
  for (let i = 0; i < of; i++) h += `<i${i < n ? '' : ' class="e"'}></i>`;
  return h + '</span>';
}
export function exFrame(label, inner) {
  return `<div class="ex"><p class="ex-h"><span>example screen</span><span>${label}</span></p><div class="ex-b" inert>${inner}</div></div>`;
}
export function steps(arr) {
  return `<div class="steps">${arr.map((s, i) => `<div class="step"><span class="n">${i + 1}</span><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}</div>`;
}
export function signStrip(title, items) {
  return `<div class="card hl section"><p class="ch">after you sign in</p><h2 class="h3" style="font-size:21px;margin-bottom:14px">${title}</h2><div class="ticks">${items.map(t => `<p>${I.check}<span>${t}</span></p>`).join('')}</div><div class="row"><a class="btn pri" href="/signin">Sign in</a><a class="btn sec" href="/register">Register to use the service</a></div><p class="note">Register once, with the email address you gave your course organizer.</p></div>`;
}
export function tiles(arr) {
  return `<div class="tiles">${arr.map(t => `<div class="tile"><p class="k">${t[0]}</p><p class="v">${t[1]}</p>${t[2] ? `<p class="s${t[3] ? ' ' + t[3] : ''}">${t[2]}</p>` : ''}</div>`).join('')}</div>`;
}
export function hbars(items, o = {}) {
  const min = o.min || 0, max = o.max || 100, fmt = o.fmt || (v => v);
  return `<div class="hbars">${items.map(it => {
    const val = it.v == null ? 0 : it.v;
    const p = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    const pp = it.p != null ? Math.max(0, Math.min(100, ((it.p - min) / (max - min)) * 100)) : null;
    return `<div class="hb" data-tip="${esc(it.tip || `${it.l}: ${it.v == null ? 'no data' : fmt(it.v)}`)}"><span class="hb-l">${esc(it.l)}</span><span class="hb-t"><span class="hb-f${it.w ? ' w' : ''}" style="width:${p}%"></span>${pp != null ? `<span class="hb-p" style="left:calc(${pp}% - 1px)"></span>` : ''}</span><span class="hb-v">${it.v == null ? '–' : fmt(it.v)}</span></div>`;
  }).join('')}</div>`;
}
export function cols(items, o = {}) {
  const max = o.max || Math.max(1, ...items.map(i => i.v || 0));
  const fmt = o.fmt || (v => v);
  return `<div class="colchart" style="height:${o.h || 170}px" role="img" aria-label="${esc(o.aria || '')}">${items.map(it => `<div class="cc" data-tip="${esc(it.tip || '')}"><span class="cc-v">${it.show === false || it.v == null ? '' : fmt(it.v)}</span><span class="cc-t"><span class="cc-b" style="height:${max ? ((it.v || 0) / max) * 100 : 0}%;${it.c ? 'background:' + it.c : ''}"></span></span><span class="cc-l">${esc(it.l)}</span></div>`).join('')}</div>`;
}
export function chart(cfg, height = 230) {
  return `<div class="chart" data-chart="${esc(JSON.stringify(cfg))}" style="height:${height}px"></div>`;
}
export const fmtDate = iso => {
  if (!iso) return '[date]';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
};
export const fmtDay = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jerusalem' }) : '–');

// ---------- layout ----------
const MAIN = [
  { k: 'class', t: 'Learn in class', s: 'Class', ic: 'klass' },
  { k: 'study', t: 'Study alone', s: 'Study', ic: 'study' },
  { k: 'projects', t: 'Submit projects', s: 'Projects', ic: 'projects' },
  { k: 'exam', t: 'Exam finale', s: 'Exam', ic: 'exam' },
];
export const HOME = { visitor: '/', student: '/program', demo: '/program', teacher: '/teacher/progress' };

// The menu of the program in view: the student's own, the group the teacher
// is looking at, or ASE for a visitor, since ASE is the only program on the site.
const menuOf = ctx => (hasExam(ctx.group ? ctx.group.programme : 'ase') ? MAIN : MAIN.filter(m => m.k !== 'exam'));

function header(ctx) {
  const r = ctx.role, p = ctx.path;
  const MAIN = menuOf(ctx);
  const href = k => (r === 'teacher' ? `/teacher/${k}` : `/${k}`);
  const isCur = k => p === `/${k}` || p.startsWith(`/${k}/`) || p === `/teacher/${k}` || p.startsWith(`/teacher/${k}/`);
  const cur = path => (p === path ? ' aria-current="page"' : '');
  const nav = MAIN.map(m => `<a href="${href(m.k)}"${isCur(m.k) ? ' aria-current="page"' : ''}>${I[m.ic]}<span class="lab-l">${m.t}</span><span class="lab-s">${m.s}</span></a>`).join('');
  let drawer = `<p class="lbl">${r === 'teacher' ? 'teacher' : 'your course'}</p>` + MAIN.map(m => `<a href="${href(m.k)}"${isCur(m.k) ? ' aria-current="page"' : ''}>${I[m.ic]}${m.t}</a>`).join('');
  let acct = '', sub = '';
  // The last name and the status open My account, which holds Sign out
  // (decision of 31 October 2026).
  const me = r === 'visitor' ? '' : `<a class="who" href="/account"${cur('/account')} title="My account"><span class="dot${r === 'student' ? '' : ' h'}"></span>${esc(displayName(ctx.user))} · ${r}</a>`;
  if (r === 'visitor') {
    acct = `<a class="who" href="/register"${cur('/register')}>Register</a><a class="btn out" href="/signin" style="min-height:40px">Sign in</a>`;
    drawer += `<p class="lbl">you</p><a href="/program"${cur('/program')}>My program</a><a href="/progress"${cur('/progress')}>My progress</a><a href="/signin"${cur('/signin')}>Sign in</a><a href="/register"${cur('/register')}>Register to use the service</a>`;
  } else if (r === 'student' || r === 'demo') {
    acct = `<a class="who" href="/program"${cur('/program')}>My program</a><a class="who" href="/progress"${cur('/progress')}>My progress</a>${me}`;
    drawer += `<p class="lbl">you · ${esc(ctx.user.email)}</p><a href="/account"${cur('/account')}>My account · ${esc(displayName(ctx.user))}</a><a href="/program"${cur('/program')}>My program</a><a href="/progress"${cur('/progress')}>My progress</a>`;
  } else {
    acct = me;
    drawer += `<p class="lbl">you · ${esc(ctx.user.email)}</p><a href="/account"${cur('/account')}>My account · ${esc(displayName(ctx.user))}</a>`;
    const T = [['/teacher/progress', 'Class progress'], ['/teacher/satisfaction', 'Satisfaction'], ['/teacher/access', 'Groups and access'], ['/teacher/agents', 'Agents']];
    sub = `<div class="subnav"><div class="wrap in">${T.map(a => `<a href="${a[0]}${ctx.groupQuery || ''}"${p === a[0] ? ' aria-current="page"' : ''}>${a[1].toLowerCase()}</a>`).join('')}</div></div>`;
    drawer += '<p class="lbl">reports and admin</p>' + T.map(a => `<a href="${a[0]}"${cur(a[0])}>${a[1]}</a>`).join('');
  }
  drawer += `<p class="lbl">school</p><a href="/"${cur('/')}>Home</a><a href="/agents"${cur('/agents')}>The agents</a><a href="/contact"${cur('/contact')}>Contact SAW</a><a href="/privacy"${cur('/privacy')}>Privacy notice</a>`;
  const demo = r === 'demo'
    ? `<div class="demo-bar"><div class="wrap in"><span class="tag">demo</span><span>You are signed in as <b style="color:var(--fg)">demo</b>, a sample student of the SAW demo group. Everything you enter here is deleted every night.</span><form method="post" action="/auth/signout" class="inline"><button class="linkbtn warnlink">Sign out</button></form></div></div>`
    : '';
  // Spending alerts stay on every teacher page until the teacher marks them seen.
  const alerts = r === 'teacher' ? spendAlerts() : [];
  const spend = alerts.length
    ? `<div class="demo-bar"><div class="wrap in"><span class="tag">AI</span><span>${alerts.map(x => esc(x.text)).join(' ')}</span><a href="/teacher/agents">Open Agents</a><form method="post" action="/teacher/ai/seen" class="inline"><button class="linkbtn warnlink">Mark as seen</button></form></div></div>`
    : '';
  return `<header class="hdr"><div class="wrap bar"><a class="brand" href="${HOME[r]}"><span class="p">~/</span><span class="long">school-of-agentic-work</span><span class="short">saw</span></a><nav class="nav" aria-label="Main">${nav}</nav><div class="acct">${acct}</div><button type="button" class="menu-btn" data-menu aria-expanded="false" aria-label="Open menu">${I.menu}</button></div>${sub}<div class="drawer" id="drawer"><div class="wrap">${drawer}</div></div></header>${demo}${spend}`;
}

function footer(ctx) {
  const out = ctx.role !== 'visitor' ? '<form method="post" action="/auth/signout" class="inline"><button class="linkbtn">sign out</button></form>' : '';
  return `<footer class="foot"><div class="wrap in"><span>~/school-of-agentic-work</span><span class="row" style="gap:18px"><a href="/agents">the agents</a><a href="/contact">contact SAW</a><a href="/privacy">privacy notice</a>${out}<span>© 2026</span></span></div></footer>`;
}

function tabbar(ctx) {
  const r = ctx.role, p = ctx.path;
  const MAIN = menuOf(ctx);
  const href = k => (r === 'teacher' ? `/teacher/${k}` : `/${k}`);
  const isCur = k => p === `/${k}` || p.startsWith(`/${k}/`) || p === `/teacher/${k}` || p.startsWith(`/teacher/${k}/`);
  return `<nav class="tabbar" aria-label="Main"><div class="in">${MAIN.map(m => `<a href="${href(m.k)}"${isCur(m.k) ? ' aria-current="page"' : ''}>${I[m.ic].replace('width="18" height="18"', 'width="22" height="22"')}${m.s}</a>`).join('')}</div></nav>`;
}

// The helper button and its chat panel, for students and the demo login
// (decision of 31 October 2026). public/app.js runs the conversation.
function helper(ctx) {
  if (ctx.role !== 'student' && ctx.role !== 'demo') return '';
  return `<button type="button" class="helper-fab" data-helper-open aria-label="Ask the helper" aria-expanded="false" aria-controls="helper"><img src="/helper/avatar" alt=""></button>
<section class="helper" id="helper" hidden aria-label="Helper"><header class="helper-h"><img src="/helper/avatar" alt=""><div><b>Helper</b><span>Answers about the site and your course</span></div><button type="button" class="helper-x" data-helper-close aria-label="Close">${I.x}</button></header>
<div class="helper-log" data-helper-log aria-live="polite"><div class="hm a">How can I help? Ask me about the site, your course, the textbook or your projects, in any language.</div></div>
<form class="helper-f" data-helper-form><textarea class="inp" name="q" rows="2" maxlength="3000" placeholder="Write your question" aria-label="Your question" required></textarea><button class="btn pri" type="submit">Send</button></form>
<p class="helper-n" data-helper-note>Your name and address are not sent with your questions. 20 questions a day.</p></section>`;
}

export function layout(ctx, title, body, flash) {
  const note = flash ? `<div class="wrap" style="padding-top:20px"><p class="flash" role="status">${esc(flash)}</p></div>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · School of Agentic Work</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/static/app.css">
<script type="module" src="/static/app.js"></script>
</head>
<body>
<div class="app">${header(ctx)}${note}<main class="main" id="main">${body}</main>${footer(ctx)}${tabbar(ctx)}</div>${helper(ctx)}
<div id="tip" role="tooltip" hidden></div>
</body>
</html>`;
}
