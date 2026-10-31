// School pages: home, the agents, privacy notice, contact, sign-in and registration.
import { esc, I, ag, agS, head, logLines, steps } from '../html.js';
import { config, googleConfigured } from '../config.js';
import { groupLabel } from '../model.js';

export const AGENTS = [
  { id: 'steward', role: 'Coordinator', where: 'Behind every part of the school',
    does: 'Assigns work to the other agents, checks that each task is finished, passes messages from Contact SAW to the teacher and prepares the teacher’s daily brief.',
    never: 'It never changes a grade, a rule or a group list on its own.' },
  { id: 'registrar', role: 'Access', where: 'Registration and sign-in',
    does: 'Checks each registration against the list of permitted addresses that the teacher keeps, and places each student in the right institution and group.',
    never: 'It never adds an address to the list. The teacher does that.' },
  { id: 'proctor', role: 'Live lessons', where: 'Learn in class',
    does: 'Opens the warm-up quiz before the lecture, releases each exercise when the teacher says, times it, records the answers and shows the class results.',
    never: 'It never releases an exercise without the teacher.' },
  { id: 'tutor', role: 'Self-study', where: 'Study alone',
    does: 'Guides students through study pages and practice exercises, answers questions about the course rules, the lessons and the site, and suggests what to review.',
    never: 'It never writes project code for a student and never sees grades.' },
  { id: 'reviewer', role: 'Project checks', where: 'Submit projects',
    does: 'Checks each submitted repository for public access, a context file, a steady history and tests, and explains every failed check.',
    never: 'It never grades. The teacher grades the work itself.' },
  { id: 'examiner', role: 'Final exam', where: 'Exam finale',
    does: 'Tracks each student’s readiness, runs practice exams and the exam session, and marks the closed questions.',
    never: 'It never sets a final mark. The teacher reviews every exam.' },
  { id: 'analyst', role: 'Progress and satisfaction', where: 'My progress and the teacher’s reports',
    does: 'Collects lesson ratings and survey answers, shows each student their own progress, shows the teacher the class picture and groups written comments into themes.',
    never: 'It never shows the teacher ratings from fewer than 5 students, and ratings never affect grades.' },
];

const signed = ctx => ctx.role === 'student' || ctx.role === 'demo';

export function home(ctx) {
  const log = [['proctor', 'opened the warm-up quiz for the lesson'], ['proctor', 'released the exercise after block 2'], ['tutor', 'answered 12 questions about the last module'], ['reviewer', 'checked 6 repositories and explained 9 failed checks'], ['analyst', 'sent the weekly satisfaction report'], ['steward', 'prepared the teacher’s daily brief']];
  const comp = [
    ['class', 'klass', 'Learn in class', 'In class or on Zoom, you answer a warm-up quiz before the lecture and a short exercise after each 15-minute block.', 'proctor'],
    ['study', 'study', 'Study alone', 'Each module has a study page and practice exercises, and a tutor answers your questions about the course and the site.', 'tutor'],
    ['projects', 'projects', 'Submit projects', 'You link the public repository of each project. The reviewer checks its structure and history and explains every failed check.', 'reviewer'],
    ['exam', 'exam', 'Exam finale', 'You follow your readiness for the final exam, take practice exams, and then sit the exam itself.', 'examiner'],
  ];
  const cta = signed(ctx)
    ? '<a class="btn pri" href="/programme">Go to my programme</a><a class="btn sec" href="/progress">My progress</a>'
    : ctx.role === 'teacher' ? '<a class="btn pri" href="/teacher/progress">Open class progress</a>'
      : '<a class="btn pri" href="/signin">Sign in</a><a class="btn sec" href="/register">Register to use the service</a>';
  return `<section class="hero"><div class="wrap in"><div class="txt">
   <p class="eyebrow"><span class="p">$</span> whoami</p>
   <h1 class="display">School of Agentic Work</h1>
   <p class="lede">This is where you work on your course, during lessons and between them. Your teacher teaches every lesson and sets every grade. A team of named agents runs the exercises, checks your projects, answers your questions and shows you your progress.</p>
   <div class="row" style="margin-top:28px">${cta}</div>
   ${ctx.role === 'visitor' ? '<p class="small" style="margin-top:14px">First time here? Register with the email address you gave your course organiser. <a href="/class">See how a lesson runs</a>.</p>' : ''}
   </div><div class="term"><div class="top"><i></i><i></i><i></i><span style="margin-left:6px">school.log</span><span class="sample" style="margin-left:auto">example</span></div><div class="body log">${logLines(log)}</div></div>
   </div></section>
   <section class="band deep"><div class="wrap in"><div class="sechead"><h2 class="h2">What you do here</h2><p class="small">4 sections, each run by one agent under your teacher</p></div>
   <div class="cols" style="--b:240px">${comp.map(c => `<a class="card" href="/${c[0]}" style="display:flex;flex-direction:column;gap:10px;text-decoration:none;color:inherit"><span style="color:var(--accent)">${I[c[1]].replace('width="18" height="18"', 'width="26" height="26"')}</span><h3 class="h3" style="margin:0">${c[2]}</h3><p class="fg2" style="margin:0;font-size:15px">${c[3]}</p><span class="row" style="margin-top:auto;justify-content:space-between">${agS(c[4])}<span class="mono small" style="color:var(--accent)">how it works</span></span></a>`).join('')}</div></div></section>
   <section class="band"><div class="wrap in"><div class="sechead"><h2 class="h2">Your programme and your progress</h2></div>
   <div class="cols" style="--b:260px">
   <a class="card" href="/programme" style="text-decoration:none;color:inherit"><p class="ch">my programme</p><h3 class="h3">You see your whole programme</h3><p class="fg2" style="margin:0;font-size:15px">The site knows your institution and group from the address you register with, and it shows the curriculum, the lesson calendar and the rules of your programme.</p></a>
   <a class="card" href="/progress" style="text-decoration:none;color:inherit"><p class="ch">my progress</p><h3 class="h3">You see your own progress</h3><p class="fg2" style="margin:0;font-size:15px">Every answer, module, project check and your readiness for the exam, set against the average of your group.</p></a>
   <div class="card"><p class="ch">your ratings</p><h3 class="h3">Your ratings stay anonymous</h3><p class="fg2" style="margin:0;font-size:15px">You rate each lesson in a few seconds. Your teacher sees ratings only from groups of 5 or more, and ratings never affect grades.</p></div>
   </div></div></section>
   <section class="band deep"><div class="wrap in"><div class="sechead"><h2 class="h2">The agents</h2><a class="mono" href="/agents" style="min-height:44px;display:inline-flex;align-items:center">what each agent does and never does</a></div>
   <div class="cols" style="--b:220px">${AGENTS.map(a => `<a class="card" href="/agents" style="text-decoration:none;color:inherit;padding:16px 18px"><span class="agent">@${a.id}</span><p style="margin:8px 0 2px;font-weight:800">${a.role}</p><p class="small">${a.where}</p></a>`).join('')}</div></div></section>
   <section class="band"><div class="wrap in" style="display:flex;flex-wrap:wrap;gap:36px;align-items:center">
   <div class="photo" role="img" aria-label="Photo placeholder" style="flex:0 0 220px;height:260px;max-width:100%">photo</div>
   <div style="flex:999 1 420px;min-width:0"><p class="eyebrow"><span class="p">$</span> teacher</p><h2 class="h2" style="font-size:34px">Mikael Gorsky</h2>
   <p class="fg2" style="margin:0 0 10px;font-size:17px;max-width:62ch">Mikael Gorsky teaches every programme on this site. He is a senior researcher at the School of Computer Science, Holon Institute of Technology.</p>
   <p class="fg2" style="margin:0 0 10px;font-size:17px;max-width:62ch">He wrote the textbook on agentic software engineering that the course follows, forthcoming from Springer.</p>
   <p class="fg2" style="margin:0;font-size:17px;max-width:62ch">He builds software with AI agents himself, after 30 years leading consulting, software implementation and book publishing organisations.</p></div>
   </div></section>
   <section class="band deep"><div class="wrap in" style="display:flex;flex-wrap:wrap;gap:20px 40px;align-items:center;justify-content:space-between">
   <div style="flex:1 1 420px;min-width:0"><p class="eyebrow"><span class="p">$</span> contact</p><h2 class="h2">Contact SAW</h2><p class="fg2" style="margin:0;font-size:17px">Questions about registration, signing in or your programme? Write to us, and your teacher answers by email.</p></div>
   <a class="btn pri" href="/contact">Write to SAW</a></div></section>`;
}

export function agents() {
  return `<div class="wrap page">${head('ls agents/', 'The agents', 'Your teacher works with a team of 7 named agents. Each agent has one role and works in one part of the school. Each agent also has limits, and this page lists them.', '<span class="chip">7 agents</span><span class="chip">1 teacher</span>')}
   <div class="card warnb" style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:12px 28px;align-items:flex-start"><div style="flex:1 1 220px"><span class="human">teacher</span><p style="margin:8px 0 0;font-weight:800;font-size:19px">Mikael Gorsky</p></div><p class="fg2" style="flex:999 1 420px;margin:0;font-size:15.5px">Teaches the lessons, writes the exercises and the rules, keeps the list of addresses permitted to register and sets every grade. Each agent reports to him, and every decision about a person waits for his approval.</p></div>
   <div class="cols" style="--b:340px">${AGENTS.map(a => `<article class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row" style="justify-content:space-between"><span class="agent" style="font-size:15px">@${a.id}</span><span class="chip">${a.role}</span></div><dl class="kv" style="margin:0"><dt>works in</dt><dd>${a.where}</dd><dt>does</dt><dd>${a.does}</dd><dt>never</dt><dd>${a.never}</dd></dl></article>`).join('')}</div>
   <div class="section"><div class="sechead"><h2 class="h2">A lesson day in the log</h2><span class="sample">example</span></div><div class="card log">
   ${logLines([['steward', 'asked @proctor to prepare the lesson from the teacher’s plan'], ['proctor', 'opened the warm-up quiz, 33 of 34 students answered'], ['teacher', 'started the lecture on Zoom', true], ['proctor', 'released the exercise after block 1 on the teacher’s signal'], ['tutor', 'answered 7 questions about the module after the lesson'], ['reviewer', 'checked 4 repositories pushed after the lesson'], ['analyst', 'closed the lesson rating with 28 answers'], ['steward', 'put 2 messages from Contact SAW in the teacher’s brief']])}
   </div></div></div>`;
}

export function privacy() {
  const card = (t, x) => `<div class="card"><h2 class="h3">${t}</h2><p class="fg2" style="margin:0">${x}</p></div>`;
  return `<div class="wrap page" style="max-width:820px">${head('cat privacy.txt', 'Privacy notice', 'This summary tells you what the school keeps about you and why.')}<div class="stack">
   ${card('Who is responsible', 'Mikael Gorsky runs this site and is responsible for the data it keeps. You can ask him to show, correct or delete your data at any time through <a href="/contact">Contact SAW</a>.')}
   ${card('What the site keeps', 'The email address you register with, and the institution, group and programme that your teacher wrote beside it on the list of permitted addresses. The site also keeps your answers to exercises, your project links and the results of their checks, and the messages you send through Contact SAW. When you sign in with Google, it also keeps your first and last name and your profile photo from your Google account, and the comment you write on My account. Only you and the teacher see them. You can correct your name on My account. The site never asks for an ID number.')}
   ${card('Ratings and surveys', 'Lesson ratings and survey answers are anonymous to the teacher. He sees them only as totals from groups of 5 or more students, and they never affect any grade.')}
   ${card('Services that process the data', 'The site runs in a Podway pod in [region]. Questions to @tutor go to an AI service without your name or email address. Do not write personal matters in those questions.')}
   ${card('How long it is kept', 'Course data is deleted [period] after the end of the course, once the time for grade appeals has passed.')}
   ${card('The demo login', 'The demo login belongs to no person. The site records when it is used and which pages are opened, and it deletes everything entered under it every night.')}
   ${card('If you do not want to use the site', 'You can do the lesson exercises in another way, for example by email to the teacher. Tell him at the start of the course.')}
   </div></div>`;
}

export function contact(ctx) {
  if (ctx.query.sent) return `<div class="wrap page"><div class="card hl" style="max-width:640px;margin:20px auto 0"><p class="eyebrow"><span class="p">$</span> contact</p><h1 class="h2">Message sent</h1><p class="fg2" style="margin:0 0 18px">${agS('steward')} has passed your message to Mikael Gorsky. He answers by email.</p><a class="btn sec" href="/">Back to the home page</a></div></div>`;
  const mail = ctx.role === 'student' ? esc(ctx.user.email) : '';
  return `<div class="wrap page"><div class="cols" style="align-items:flex-start;gap:32px;max-width:1080px;margin-inline:auto">
   <form method="post" action="/contact" style="--b:480px;flex:999 1 480px;display:flex;flex-direction:column;gap:18px">
   <div><p class="eyebrow"><span class="p">$</span> contact</p><h1 class="h1">Contact SAW</h1><p class="lede">Write to us about registration, signing in or your programme. Your teacher answers by email.</p></div>
   ${ctx.query.e ? '<p class="alert">Write your email address and a message, so that the teacher can answer.</p>' : ''}
   <div class="cols" style="--b:220px;gap:16px"><div><label class="f" for="cn">name</label><input class="inp" id="cn" name="name" maxlength="120" placeholder="Your name"></div><div><label class="f" for="ce">email</label><input class="inp" id="ce" name="email" type="email" required maxlength="200" placeholder="Your email address" value="${mail}"></div></div>
   <div><label class="f" for="ct">about</label><select class="inp" id="ct" name="topic"><option>Registration and signing in</option><option>My programme</option><option>Something else</option></select></div>
   <div><label class="f" for="cm">message</label><textarea class="inp" id="cm" name="body" rows="5" required maxlength="4000" placeholder="Your message"></textarea></div>
   <div class="row"><button class="btn pri" type="submit">Send message</button><span class="small">Do not send ID numbers or other personal documents.</span></div></form>
   <aside class="card" style="flex:1 1 280px"><p class="ch">what happens next</p>
   ${['@steward passes your message to the teacher.', 'Mikael Gorsky reads it and answers by email.'].map((t, i) => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start;margin-bottom:14px"><span class="chip" style="flex:0 0 auto">${i + 1}</span><p class="fg2" style="margin:0;font-size:15px">${esc(t)}</p></div>`).join('')}
   </aside></div></div>`;
}

function googleButton(intent, label) {
  if (!googleConfigured()) return '<p class="alert">Google sign-in is not set up on this server yet. The teacher needs to add the Google sign-in credentials.</p>';
  return `<a class="btn pri wide" href="/auth/google?intent=${intent}" style="min-height:52px;font-size:17px">${label}</a>`;
}
function devForm(intent) {
  if (!config.devLogin) return '';
  return `<form method="post" action="/auth/dev" class="card dash" style="margin-top:16px;padding:16px"><p class="ch" style="color:var(--warn)">development sign-in</p><input type="hidden" name="intent" value="${intent}"><div class="row" style="flex-wrap:nowrap"><label class="sr" for="dev">address</label><input class="inp" id="dev" name="email" type="email" placeholder="any address"><button class="btn sec" type="submit">Enter</button></div><p class="small" style="margin-top:6px;font-size:13px">Shown only because DEV_LOGIN is set. Never set it in the pod.</p></form>`;
}
const refusedMsg = '<p class="alert">The site did not accept this address, because it is not on your group’s list. Check that it is the address you gave your course organiser. If it is, write to us through <a href="/contact">Contact SAW</a> and say which programme and group you are in.</p>';

export function signin(ctx) {
  const err = ctx.query.e === 'refused' ? refusedMsg : ctx.query.e === 'demo' ? '<p class="alert">The demo login or password is wrong.</p>' : ctx.query.e ? `<p class="alert">${esc(ctx.query.e)}</p>` : '';
  return `<div class="wrap page"><div class="cols" style="align-items:flex-start;gap:32px;max-width:1080px;margin-inline:auto">
   <div style="--b:340px"><p class="eyebrow"><span class="p">$</span> sign-in</p><h1 class="h1">Sign in</h1><p class="lede" style="margin-bottom:22px">Sign in with the address you registered with. The site then opens your programme.</p>
   <div class="card flat"><p class="ch">not registered yet?</p><p class="fg2" style="margin:0 0 14px;font-size:15px">Register once, with the email address you gave your course organiser.</p><a class="btn sec" href="/register">Register to use the service</a></div></div>
   <div class="stack" style="--b:380px">${err}
   <div class="card" style="padding:26px">${googleButton('signin', 'Sign in with Google')}
   <p class="small" style="margin-top:14px;font-size:13px">If your address is not a Google address, or the site does not let you in, write to us through <a href="/contact">Contact SAW</a>.</p>${devForm('signin')}</div>
   ${config.demoPassword ? `<form method="post" action="/auth/demo" class="card dash" style="padding:22px"><p class="ch">demo login</p><p class="fg2" style="margin:0 0 14px;font-size:15px">For people who have received a demo login. It opens the site as a sample student.</p>
   <div class="cols" style="--b:160px;gap:12px"><div><label class="f" for="dl">login</label><input class="inp" id="dl" name="login" autocomplete="username" placeholder="demo"></div><div><label class="f" for="dp">password</label><input class="inp" id="dp" name="password" type="password" autocomplete="current-password" placeholder="password"></div></div>
   <button type="submit" class="btn out" style="margin-top:14px">sign in to the demo</button></form>` : ''}
   </div></div></div>`;
}

export function register(ctx) {
  if (ctx.query.done && ctx.user && ctx.group) {
    return `<div class="wrap page"><div class="card hl" style="max-width:680px;margin:20px auto 0"><p class="eyebrow"><span class="p">$</span> register</p><h1 class="h2">You are registered</h1><p class="fg2" style="margin:0 0 16px">${agS('registrar')} found your address on the list your teacher keeps, and placed you in your group.</p>
     <dl class="kv" style="margin:0 0 20px"><dt>address</dt><dd>${esc(ctx.user.email)}</dd><dt>institution</dt><dd>${esc(ctx.group.institution)}</dd><dt>group</dt><dd>${esc(ctx.group.code)}</dd><dt>programme</dt><dd>${esc(ctx.programme ? ctx.programme.title : ctx.group.programme)}</dd></dl>
     <p class="small" style="margin:0 0 18px">From now on, sign in with the same address.</p><a class="btn pri" href="/programme">Go to my programme</a></div></div>`;
  }
  const err = ctx.query.e === 'refused' ? refusedMsg : ctx.query.e ? `<p class="alert">${esc(ctx.query.e)}</p>` : '';
  return `<div class="wrap page"><div class="cols" style="align-items:flex-start;gap:32px;max-width:1080px;margin-inline:auto">
   <div style="--b:360px"><p class="eyebrow"><span class="p">$</span> register</p><h1 class="h1">Register to use the service</h1><p class="lede" style="margin-bottom:22px">You register once. After that, you sign in with the same address.</p>
   <div class="card warnb"><p class="ch" style="color:var(--warn)">use the right address</p><p class="fg2" style="margin:0 0 10px">Register with the email address you gave your course organiser. If it is a Gmail address, register with Google.</p><p class="fg2" style="margin:0">The site accepts only addresses that your teacher has put on a group list. It reads your institution and group from that list, so you do not enter them yourself.</p></div></div>
   <div class="stack" style="--b:380px">${err}<div class="card" style="padding:26px">${googleButton('register', 'Register with Google')}
   <div style="margin-top:22px;border-top:1px solid var(--line);padding-top:18px"><p class="ch">if your address is not a Google address</p><p class="fg2" style="margin:0;font-size:15px">Registration by an email link is not available yet. Write to us through <a href="/contact">Contact SAW</a>, and say which programme and group you are in.</p></div>${devForm('register')}</div>
   <div class="card flat"><p class="ch">what the site keeps</p><p class="fg2" style="margin:0 0 6px;font-size:15px">Your email address and the institution and group on your teacher’s list, your answers to exercises and your project links. It does not keep your name or photo from Google.</p><p class="fg2" style="margin:0 0 6px;font-size:15px">Your lesson ratings are anonymous and never affect grades.</p><a href="/privacy" style="min-height:44px;display:inline-flex;align-items:center">Read the privacy notice</a><p class="small" style="font-size:13px">By registering, you confirm that you have read the privacy notice.</p></div>
   </div></div></div>`;
}

export function notFound() {
  return `<div class="wrap page"><div class="card" style="max-width:640px;margin:20px auto 0"><p class="eyebrow"><span class="p">$</span> cd</p><h1 class="h2">This page does not exist</h1><p class="fg2" style="margin:0 0 18px">Check the address, or go back to the home page.</p><a class="btn sec" href="/">Home</a></div></div>`;
}
export function forbidden(msg) {
  return `<div class="wrap page"><div class="card" style="max-width:640px;margin:20px auto 0"><p class="eyebrow"><span class="p">$</span> access</p><h1 class="h2">This page is not open to you</h1><p class="fg2" style="margin:0 0 18px">${esc(msg || 'Sign in with an account that has access to this page.')}</p><a class="btn sec" href="/">Home</a></div></div>`;
}

export { groupLabel, steps, ag };
