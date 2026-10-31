# Context for agents working on School of Agentic Work

## What this project is

School of Agentic Work (SAW) is a teaching platform for students enrolled in programmes taught by Mikael Gorsky. The first programme on it is Agentic software engineering (ASE), taught at Holon Institute of Technology. The platform supports students during live lessons and between them, and it shows potential clients of the teacher how deep this support is.

Mikael Gorsky owns the project and makes every decision about it. You work for him.

## Read these before any work

Read `docs/specification.md` for what the site does and the rules it follows. Read `docs/decisions.md` for what has been decided and why. Open `mockup/index.html` for the agreed design. The mockup is the reference for layout, wording and behaviour. Where the specification and the mockup disagree, the specification wins, and you report the difference to the owner.

## Rules of the product

Every text on the site addresses the student. Do not write copy aimed at clients, employers or the general public.

A visitor who has not signed in sees every section in a general form: how it works, an example screen that cannot be used, and what signing in adds. Never hide a section behind a lock. After sign-in, the same page shows the student's own data.

A student can register only with an address on the teacher's list of permitted addresses. The institution, group and programme come from that list, and the student never enters them.

The demo login is a sample student. It sees only the student side, it can never open a teacher page, and everything entered under it is deleted every night.

The site never asks for, imports or stores an ID number. When it reads a Moodle export, it reads only the email and group columns.

Lesson ratings and survey answers are anonymous to the teacher. The teacher sees them only as totals from 5 or more students. Ratings never affect any grade.

Questions to the tutor agent go to the AI service without the student's name or email address.

Agents never grade, never add a person to a group and never change a rule on their own. Every decision about a person waits for the teacher.

## How to write copy

Write in plain English, in full sentences with a subject and a verb. Use the plainest word that carries the meaning. Write numbers as digits. Use capital letters only at the start of a sentence or heading and for names and abbreviations. Name things by what a student recognises, not by how the system is built.

## How to work

Before any major change, or any change that touches several files, describe the options to the owner with examples, and wait for his approval. Small local fixes may go ahead directly.

Make one change per commit, and write a commit message that says what changed and why. Do not write one-word messages such as "fix" or "update".

Write tests for every rule that protects access or privacy: the list of permitted addresses, the separation of the demo login, the threshold of 5 for ratings, and the rule that no ID number is stored.

Where code follows from a decision, write in a comment why it does what it does, and give the date of the decision in `docs/decisions.md`.

At the end of each working session, add the decisions taken in it to `docs/decisions.md`, with their date and reason.
