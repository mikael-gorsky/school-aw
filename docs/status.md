# Status of the build

This file tells the next session where the work stands. It was written on 31 October 2026, when the first working version of the site was pushed to GitHub, so that the work could move to a session that runs inside the Podway pod.

## What is built

The site is a working web application that follows the agreed mockup. Every page of the mockup exists at its own address, and each page works for the 4 kinds of user: the visitor, the student, the demo login and the teacher.

A visitor sees the general form of every section with example screens. A student registers with Google, and the site places the student in the group written beside the address on the teacher's list. The student answers live exercises during a lesson, rates the lesson afterwards, answers the course survey, studies the module pages and practises, asks the tutor, submits project repositories for a check by @reviewer, follows the readiness for the exam and sees personal progress against the group.

The teacher runs a lesson from the Learn in class console: he adds a lesson, starts it, releases each exercise, watches the answers arrive, shows the results to the class and ends the lesson. He sees the class progress, the satisfaction report, the questions that the tutor passed on, the project checks and the readiness of the class. He keeps the list of permitted addresses, uploads a Moodle export, handles refused registrations and messages from Contact SAW, and sees the activity of the agents.

The demo login is a sample student in a demo group of 33 sample students, with 8 lessons held and lesson 9 running. In the demo group @proctor opens the exercises by itself every 2 minutes, so that a visitor with the demo login sees a live lesson at any time. The whole demo group is built again from a fixed seed every night at 03:00 Israel time, and the teacher can also reset it from the Groups and access page.

## How the code is organised

The site needs only Node.js 22.13 or later. It has no packages to install, because it uses the database built into Node (`node:sqlite`) and Node's own HTTP server and test runner.

`server/main.js` starts the site. `server/app.js` holds every route and the rules that apply to each request: sessions, the check that a form comes from the site itself, the roles allowed on each route, and the security headers. `server/pages/` holds the HTML of the pages: `public.js` for the school pages, sign-in and registration, `student.js` for the student side and `teacher.js` for the teacher side. `server/html.js` holds the layout and the small building blocks, with the class names of the mockup. `public/app.css` is the stylesheet of the mockup, and `public/app.js` draws the charts, polls the live lesson, sends answers and questions, and reads a CSV file in the browser.

`server/db.js` creates the database tables. `server/model.js` computes every figure that the pages show, including the threshold of 5 for ratings. `server/auth.js` handles sessions, Google sign-in, the demo login and the list of permitted addresses. `server/csv.js` reads only the email and group columns of a CSV file. `server/reviewer.js` checks a GitHub repository. `server/ai.js` sends the tutor's questions and the comments for grouping into themes to the Claude API. `server/demo.js` builds and resets the demo group.

The content of a programme lives in `content/<programme>/`: `programme.json` holds the description, parts, modules, grade parts, project rules and documents; `module-NN.json` holds a study page; `lessons.json` holds the live exercises of each module; and `rules.md` is the text from which @tutor answers.

The tests in `test/` cover the rules that protect access and privacy, as CLAUDE.md requires. Run them with `npm test`.

## How to run it

In development, run `npm run dev` with `DEV_LOGIN=1`, `TEACHER_EMAILS` and `DEMO_PASSWORD` set. The sign-in page then shows a development form that signs in as any address.

In the pod, run `npm start` as a service that Podway supervises, on the port of the pod's preview. The settings come from the environment, and their names are listed in `.env.example`. `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TEACHER_EMAILS` and `DEMO_PASSWORD` must be set before anyone else uses the site. `ANTHROPIC_API_KEY` turns on the tutor and the grouping of comments, and `GITHUB_TOKEN` raises GitHub's limit for repository checks. `DEV_LOGIN` must never be set in the pod.

`SESSION_SECRET` must stay the same for the life of the site. It signs the sessions, and it also makes the one-way keys that let a student find their own anonymous rating. If it changes, every student could rate each lesson again.

The Google sign-in client must list `<BASE_URL>/auth/google/callback` as an authorised redirect address.

`npm run backup` writes a copy of the database to `backups/`. The copy must also be moved out of the pod, because the pod's workspace is not a backup.

## What differs from the specification

These points were left out or done differently in this first version. Each one should go to the owner for a decision.

Registration by a link sent by email is not built. The registration page tells a student whose address is not a Google address to write to Contact SAW. Sending such links needs an email service, which is still an open question in the specification.

The specification says the teacher can change the demo password. In this version the password is the secret `DEMO_PASSWORD`, which the owner changes in the pod's Secrets panel.

The teacher answers messages from Contact SAW, and writes to a flagged student, through his own email program. The site opens a new email with the address filled in. The site does not send email itself.

The study page asks only about the clarity of a module, as section 6.1 of the specification says. Section 6.3 and the mockup show clarity, pace and usefulness for each module. The teacher's report therefore shows clarity only. The owner should decide whether the study page should ask about pace and usefulness too.

Practice exams, the draft of exam part A and editing the readiness conditions are not built. The exam page says that practice exams open later. The readiness condition about practice exams therefore cannot be met yet.

The teacher's Study alone page has no chart of the most asked topics, because the site keeps a question only when the tutor passes it to the teacher. Keeping every question, even without the asker, would need a decision by the owner.

The tutor is not closed during the exam yet.

Only module 1 has a study page and practice exercises, and only modules 1 and 9 have live exercises in `content/ase/lessons.json`. In the demo group the other lessons use sample questions. The content of modules 2 to 19 is an open question in the specification.

The grade weights, the exam settings, the dates and the period for which data is kept are still placeholders. The teacher enters the weights and exam settings on the teacher's Exam finale page.

## Next steps in the pod

Check the pod's live configuration and the port of its preview. Clone the repository into the persistent workspace, run `npm test`, and start the site with `DEV_LOGIN=1` to check it on the preview while the preview is still owner-only. Then ask the owner to add the secrets, set up the site as a supervised service without `DEV_LOGIN`, and test sign-in in a signed-out browser before the preview is made public. Set up a regular backup and write down in `docs/deployment-podway.md` where the copies go.
