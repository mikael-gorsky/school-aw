# School of Agentic Work

School of Agentic Work (SAW) is a teaching platform for students who are enrolled in programs taught by Mikael Gorsky. It supports them during live lessons, in class or on Zoom, and between lessons. A team of named AI agents runs the exercises, checks projects, answers questions and reports on progress, and the teacher directs them and sets every grade.

The site does not offer programs to the public. Every page addresses the student. A visitor who has not signed in sees each part of the site in a general form, and a person who has received the demo login can use the site as a sample student.

## Status

The first working version of the site is built and follows the agreed mockup. `docs/status.md` describes what is built, how the code is organized, how to run it, and where this version differs from the specification.

## What is in the repository

`docs/specification.md` describes what the site does, for whom, and under which rules.

`docs/decisions.md` records each decision about the site, with its date and the reason for it.

`mockup/index.html` is the agreed design as a clickable page with sample data. Open it in a browser. The bar at the top switches between the visitor, a student, the demo login and the teacher, and between desktop, tablet and phone widths.

`docs/status.md` describes the state of the build.

`docs/deployment-podway.md` describes how the site runs in the Podway pod.

`server/`, `public/` and `content/` hold the site itself, and `test/` holds its tests.

`CLAUDE.md` is the context file for AI agents that work on this repository.

## Running the site

The site needs Node.js 22.13 or later and no other packages. Run `npm test` to run the tests. Run `npm run dev` with `DEV_LOGIN=1`, `TEACHER_EMAILS` and `DEMO_PASSWORD` set to try it on your own computer at http://localhost:8080. `.env.example` lists every setting.

## Hosting

The site runs in a Podway pod, at territorial-mink-85a7.podway.site.
