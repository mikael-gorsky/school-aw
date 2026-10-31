// My account: the user's photo and name from Google, a comment, and Sign out.
// The teacher sees the same details of each student, read-only. Other students
// never see them (decision of 31 October 2026).
import { esc, head, exFrame, signStrip, fmtDay } from '../html.js';
import { displayName } from '../auth.js';
import { get } from '../db.js';
import { programme } from '../content.js';
import * as M from '../model.js';

export const COMMENT_MAX = 2000;

const hasPhoto = id => Boolean(get('SELECT 1 AS x FROM user_photos WHERE user_id = ?', id));
const initials = u => ((u.first_name || '')[0] || '') + ((u.last_name || '')[0] || '') || displayName(u).slice(0, 2);

export function avatar(u, size = 96) {
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px`;
  return u && u.id && hasPhoto(u.id)
    ? `<img class="avatar" src="/photo/${u.id}" alt="" style="${st}">`
    : `<span class="avatar" aria-hidden="true" style="${st}">${esc(initials(u).toUpperCase())}</span>`;
}

export const roleLabel = r => (r === 'teacher' ? 'teacher' : r === 'demo' ? 'demo' : 'student');

function readonly(id, label, value) {
  return `<div><label class="f" for="${id}">${label}</label><input class="inp" id="${id}" value="${esc(value)}" readonly></div>`;
}

function groupFields(g) {
  if (!g) return '';
  return `${readonly('ai', 'institution', g.institution)}<div class="cols" style="--b:200px;gap:16px">${readonly('ag', 'group', g.code)}${readonly('ap', 'programme', programme(g.programme).title)}</div>`;
}

function form(u, g, interactive) {
  const off = interactive ? '' : ' disabled';
  return `<form method="post" action="/account" class="card" style="display:flex;flex-direction:column;gap:18px">
   <div class="row" style="gap:18px;flex-wrap:nowrap">${avatar(u)}<div style="min-width:0"><p style="margin:0;font-weight:800;font-size:20px">${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || displayName(u))}</p><p class="mono small" style="margin:4px 0 0">${esc(roleLabel(u.role))}</p></div></div>
   <div class="cols" style="--b:220px;gap:16px"><div><label class="f" for="af">first name</label><input class="inp" id="af" name="first_name" maxlength="80" value="${esc(u.first_name || '')}"${off}></div><div><label class="f" for="al">last name</label><input class="inp" id="al" name="last_name" maxlength="80" value="${esc(u.last_name || '')}"${off}></div></div>
   ${readonly('ae', 'email', u.email)}
   ${groupFields(g)}
   <div><label class="f" for="ac">comment</label><textarea class="inp" id="ac" name="comment" rows="5" maxlength="${COMMENT_MAX}" placeholder="Anything you want the teacher to know"${off}>${esc(u.comment || '')}</textarea><p class="small" style="margin:6px 0 0">Only you and the teacher see your name, photo and comment.</p></div>
   <div class="row"><button class="btn pri" type="submit"${off}>Save</button></div></form>`;
}

export function accountPage(ctx) {
  if (ctx.role === 'visitor') {
    const sample = { first_name: 'Noa', last_name: 'Cohen', email: 'noa.cohen@gmail.com', role: 'student', comment: 'I work full time, so I join most lessons on Zoom.' };
    return `<div class="wrap page" style="max-width:820px">${head('whoami', 'My account', 'This page shows your name and photo, the program and group you belong to, and a comment for your teacher.')}
     ${exFrame('the account of a student', form(sample, { institution: 'Holon Institute of Technology', code: '1', programme: 'ase' }, false))}
     ${signStrip('Sign in to see your own account.', ['your name and photo from your Google account, which you can correct', 'the institution, group and program from your teacher’s list', 'a comment that only you and the teacher see'])}</div>`;
  }
  const u = get('SELECT * FROM users WHERE id = ?', ctx.user.id);
  const g = ctx.role === 'teacher' ? null : ctx.group;
  const note = ctx.role === 'demo' ? '<p class="small" style="margin:0 0 16px">This is the account of the sample student. Everything you change here is deleted every night.</p>' : '';
  return `<div class="wrap page" style="max-width:820px">${head('whoami', 'My account', 'Your name and photo come from your Google account when you sign in. You can correct your name here.')}
   ${note}${form(u, g, true)}
   <div class="card section row" style="justify-content:space-between;align-items:center"><p class="fg2" style="margin:0">Sign out of School of Agentic Work on this device.</p><form method="post" action="/auth/signout" class="inline"><button class="btn sec">Sign out</button></form></div></div>`;
}

export function teacherStudentPage(ctx, id) {
  const u = get("SELECT * FROM users WHERE id = ? AND role IN ('student', 'demo', 'sample')", id);
  if (!u) return null;
  const g = M.groupById(u.group_id);
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
  const row = (k, v) => `<div class="li"><div class="t"><span>${k}</span><b style="font-weight:600">${v}</b></div></div>`;
  return `<div class="wrap page" style="max-width:820px">${head('whois', esc(name), g ? esc(M.groupLabel(g)) : '')}
   <div class="card"><div class="row" style="gap:18px;flex-wrap:nowrap;margin-bottom:8px">${avatar(u)}<div style="min-width:0"><p style="margin:0;font-weight:800;font-size:20px">${esc(name)}</p><p class="mono small" style="margin:4px 0 0">${esc(u.email)}</p></div></div>
   ${row('programme', g ? esc(programme(g.programme).title) : '–')}${row('registered', esc(fmtDay(u.registered_at)))}${row('last sign-in', esc(fmtDay(u.last_seen)))}
   <p class="ch" style="margin-top:18px">comment</p><p class="fg2" style="margin:0;white-space:pre-wrap">${u.comment ? esc(u.comment) : '<span class="muted">No comment.</span>'}</p>
   <div class="row" style="margin-top:18px">${u.role === 'student' ? `<a class="btn sec" href="mailto:${esc(u.email)}">Write</a>` : ''}<a class="btn out" href="/teacher/progress${g ? `?group=${g.id}` : ''}">Back to class progress</a></div></div></div>`;
}
