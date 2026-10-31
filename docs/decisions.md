# Decisions

This file records each decision about the site, with its date and the reason for it. The newest decisions come last. A later decision replaces an earlier one where they conflict, and the earlier entry says so.

## 27 October 2026

The site will support ASE students in 4 ways: short exercises during lectures, especially on Zoom, which also give a firm base for measuring engagement; study between lessons; the rules for projects; and the submission of work with feedback.

Students sign in with an email address. The site needs no course number or other institutional code. It never imports ID numbers, because the email address is enough to identify a student and an ID number is the most sensitive item in a course export.

The site is run by Mikael Gorsky. Students register themselves and accept the privacy notice. A student who does not want to use the site can do the exercises in another way, so that the use of the site is a real choice.

## 28 October 2026

The site is a platform for several programs, not for ASE alone. A different version of a program, for example with or without 2 parallel projects, is treated as a separate program.

The "Console" design was chosen from 5 directions. Its body font was changed from Inter to Manrope, and JetBrains Mono was kept for labels, because the monospace labels belong to the console look.

## 29 October 2026

The platform is named School of Agentic Work. It works through a team of named agents, each with one role. The main menu has 4 sections: Learn in class, Study alone, Submit projects and Exam finale.

The site measures and reports student satisfaction. Each student sees their own progress, and the teacher sees the class.

Ratings are anonymous to the teacher and shown only from groups of 5 or more, so that students can rate honestly and no rating can reach the person who grades them. Ratings never affect grades.

## 31 October 2026

The site does not offer programs to the public. Its main purpose is to support students enrolled in the teacher's programs. Its second purpose is to show potential clients how deep this support is. This replaces the free registration, the free first lesson and the application form planned on 28 October.

Every page addresses the student. A visitor sees every section in a general form, with example screens, and the student's own data appears after sign-in. This lets a client who does not sign in still see what the support contains.

A student registers with the address given to the course organizer, preferably Gmail. The teacher keeps the list of permitted addresses, each with an institution, a group and a program, so that the site places each student in a group without asking the student.

The demo login is a login named "demo" with a password, which people request through Contact SAW. The password is there so that asking for access has a purpose. The demo user sees only the student side. The teacher shows his own tools separately.

The site holds information only about programs that have active students. Each student sees an overview of their own program, as an institution's course page does. Information about another program can be shown to clients only through a demo login for that program.

The repository is named school-aw, and the site will be hosted at territorial-mink-85a7.podway.site.

The site is built as a Node.js application with no packages, on the database built into Node, and it renders its pages on the server with the markup of the mockup. This keeps the site easy to install and run in the pod and leaves no package to update or audit.

Students and the teacher sign in with Google. Registration by a link sent by email waits for a decision about an email service. Until then, a student whose address is not a Google address writes to Contact SAW.

A rating or survey answer is stored with a one-way key made from the student's id and a server secret, and never with the student's id. The key lets a student see and change their own rating and stops a second rating, while the teacher's pages show only totals from 5 or more students.

A CSV file of addresses, such as a Moodle export, is read in the teacher's browser. Only the email and group of each row are sent to the server, so other columns, such as ID numbers, never leave the teacher's computer. The server reads only the same 2 columns from whatever it receives.

The demo group is built again from a fixed seed every night at 03:00 Israel time, and on the first minute after that time if the pod was asleep. In the demo group @proctor opens a new exercise every 2 minutes, so that the demo shows a live lesson at any hour.

A question that @tutor cannot answer from the rules is passed to the teacher without the asker. The teacher's answer is published on the Study alone page of every student of the program, and the teacher can add it to the text from which @tutor answers.

The site is served at school.mgorsky.net, and the Google sign-in return address uses that name. A custom domain the owner controls reads better for students and clients than the pod's own address.

The site keeps SQLite, built into Node, and does not move to the Postgres server that the pod also runs. One server and a few classes of students do not need a separate database server, and moving would add a package and rewrite the data layer.

Nightly backups outside the pod are postponed. Until they are set up, the only copy of the database is the file in the pod.

Every signed-in user sees their last name and status beside the main menu, and it opens My account, which holds Sign out. Sign out was only a small link in the footer, and users did not find it.

My account shows the photo and the first and last name from the user's Google account, and a comment of up to 2,000 characters. The user can correct the names, and Google's names fill only empty fields, so a correction stays. Only the user and the teacher see the name, photo and comment, so that a student can tell the teacher something without other students seeing it. Sign-in therefore asks Google for the profile as well as the email address. The photo is copied at sign-in and served by the site, because Google's photo addresses can change.

The teacher's lists show each student by name with the email address under it, and the name opens the student's details and comment.

The list of permitted addresses may carry each student's first and last name in English. The teacher asked for it so that his lists show the names students are known by in the course. A student who registers takes the names from the list, and the names from Google fill only what is missing. The upload form still reads only the email and group columns of a CSV file.

The 44 students of the HIT fall 2026 ASE course were added from the Moodle participants export, with their English names, email addresses and groups 62121-1 and 62121-2, under the institution HIT. The export gives each student a second group, 662121-1 or 662121-2, which was left out because it repeats the first. The Hebrew names were not imported. The export was read once in the pod and is not kept in the repository.

A CSV file of students has 5 columns: first name, last name, email, group and institution. The site reads only these, and never an ID number. Names may be left out, and then they come from the student's Google account. A user can change their own name freely on My account, and once saved, neither the list nor Google changes it again. The teacher set this rule so that one file can carry a whole course, and so that each student decides how their name appears. It replaces the rule of 27 October that only the email and group columns are read.

The syllabus of 31 October 2026 is the full description of the ASE course, and the site follows it where they differ: the 4 parts and 19 modules under their syllabus names, both projects running in parallel from the first lesson, and the grade in 3 equal parts of 33%: class engagement, the Tribunal and the individual project. The rule that only a public GitHub repository is graded stays, although the syllabus does not state it.

ASE has no final exam. Exam finale, exam readiness and @examiner are hidden for a program without an exam, rather than removed, so that another program can still have one.

The lessons follow the syllabus lesson plan of 11 content lessons, most of which cover 2 modules. The teacher adds a lesson by choosing it from the plan, and the lesson takes the live exercises of each of its modules. The demo group runs on the same plan.

The study pages and live exercises of all 19 modules are written from the course textbook, with each page naming the chapter and sections it rests on. Where the textbook has no chapter for a module, the page uses only what the book says elsewhere, and does not fill the gap from general knowledge, so that the teacher can see what he still has to supply.

All of the site, its content and its documents use American spelling, at the owner's instruction. The address of My program is now /program; the old address /programme redirects to it.

The second project is called the individual project. Where it is first introduced it is called the individual (own) project.

How modules are grouped into lessons is a decision for each semester, not part of the program. The program lists only its 19 modules. The teacher adds each lesson with 1 module, or 2, and the lesson takes the live exercises of each. This replaces the lesson plan of the same day. The demo group keeps its own grouping of 11 lessons as sample data.

Students and the demo login have a helper: a round button with the teacher's photo that opens a chat. It answers questions about the site, the course and the textbook in the language the student writes in, with detailed and simple explanations. It runs on Claude Sonnet 5.5 with the site guide, the course content and the whole textbook in a cached system prompt, and it allows 20 questions a day per student. The @tutor box on Study alone stays as it is. The helper never grades, never decides about a person, and never receives the student's name or address. The textbook is kept in the pod's data folder, because the repository is public. The helper needs an API key: a Claude subscription cannot be used, because it is licensed for the owner's personal use and not for serving a site to other people.

The site spends at most $20 on the Claude API, counted from the start, not per month. Every call records its cost from the token counts the API returns. When the total reaches the limit, the helper, @tutor and the grouping of comments stop and stay stopped until the teacher allows more on the Agents page, or stops them sooner there. The teacher is told each time another $10 has been spent: an alert stays on every teacher page until he marks it seen. This replaces the monthly cap set earlier the same day, at the owner's instruction. A spending limit on the API key itself can be set only in the owner's Anthropic Console.

The helper is called the Teaching Assistant. Its button shows a drawn icon of an Ethiopian woman professor in glasses, wearing a white netela, with the label "Teaching Assistant" above it, instead of the teacher's photo. The button sits above the "Made with Podway" badge that Podway adds in the lower right corner. The same icon is the site's favicon.
