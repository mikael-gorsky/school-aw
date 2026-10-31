# Decisions

This file records each decision about the site, with its date and the reason for it. The newest decisions come last. A later decision replaces an earlier one where they conflict, and the earlier entry says so.

## 27 October 2026

The site will support ASE students in 4 ways: short exercises during lectures, especially on Zoom, which also give a firm base for measuring engagement; study between lessons; the rules for projects; and the submission of work with feedback.

Students sign in with an email address. The site needs no course number or other institutional code. It never imports ID numbers, because the email address is enough to identify a student and an ID number is the most sensitive item in a course export.

The site is run by Mikael Gorsky. Students register themselves and accept the privacy notice. A student who does not want to use the site can do the exercises in another way, so that the use of the site is a real choice.

## 28 October 2026

The site is a platform for several programmes, not for ASE alone. A different version of a programme, for example with or without 2 parallel projects, is treated as a separate programme.

The "Console" design was chosen from 5 directions. Its body font was changed from Inter to Manrope, and JetBrains Mono was kept for labels, because the monospace labels belong to the console look.

## 29 October 2026

The platform is named School of Agentic Work. It works through a team of named agents, each with one role. The main menu has 4 sections: Learn in class, Study alone, Submit projects and Exam finale.

The site measures and reports student satisfaction. Each student sees their own progress, and the teacher sees the class.

Ratings are anonymous to the teacher and shown only from groups of 5 or more, so that students can rate honestly and no rating can reach the person who grades them. Ratings never affect grades.

## 31 October 2026

The site does not offer programmes to the public. Its main purpose is to support students enrolled in the teacher's programmes. Its second purpose is to show potential clients how deep this support is. This replaces the free registration, the free first lesson and the application form planned on 28 October.

Every page addresses the student. A visitor sees every section in a general form, with example screens, and the student's own data appears after sign-in. This lets a client who does not sign in still see what the support contains.

A student registers with the address given to the course organiser, preferably Gmail. The teacher keeps the list of permitted addresses, each with an institution, a group and a programme, so that the site places each student in a group without asking the student.

The demo login is a login named "demo" with a password, which people request through Contact SAW. The password is there so that asking for access has a purpose. The demo user sees only the student side. The teacher shows his own tools separately.

The site holds information only about programmes that have active students. Each student sees an overview of their own programme, as an institution's course page does. Information about another programme can be shown to clients only through a demo login for that programme.

The repository is named school-aw, and the site will be hosted at territorial-mink-85a7.podway.site.

The site is built as a Node.js application with no packages, on the database built into Node, and it renders its pages on the server with the markup of the mockup. This keeps the site easy to install and run in the pod and leaves no package to update or audit.

Students and the teacher sign in with Google. Registration by a link sent by email waits for a decision about an email service. Until then, a student whose address is not a Google address writes to Contact SAW.

A rating or survey answer is stored with a one-way key made from the student's id and a server secret, and never with the student's id. The key lets a student see and change their own rating and stops a second rating, while the teacher's pages show only totals from 5 or more students.

A CSV file of addresses, such as a Moodle export, is read in the teacher's browser. Only the email and group of each row are sent to the server, so other columns, such as ID numbers, never leave the teacher's computer. The server reads only the same 2 columns from whatever it receives.

The demo group is built again from a fixed seed every night at 03:00 Israel time, and on the first minute after that time if the pod was asleep. In the demo group @proctor opens a new exercise every 2 minutes, so that the demo shows a live lesson at any hour.

A question that @tutor cannot answer from the rules is passed to the teacher without the asker. The teacher's answer is published on the Study alone page of every student of the programme, and the teacher can add it to the text from which @tutor answers.

The site is served at school.mgorsky.net, and the Google sign-in return address uses that name. A custom domain the owner controls reads better for students and clients than the pod's own address.

The site keeps SQLite, built into Node, and does not move to the Postgres server that the pod also runs. One server and a few classes of students do not need a separate database server, and moving would add a package and rewrite the data layer.

Nightly backups outside the pod are postponed. Until they are set up, the only copy of the database is the file in the pod.

Every signed-in user sees their last name and status beside the main menu, and it opens My account, which holds Sign out. Sign out was only a small link in the footer, and users did not find it.

My account shows the photo and the first and last name from the user's Google account, and a comment of up to 2,000 characters. The user can correct the names, and Google's names fill only empty fields, so a correction stays. Only the user and the teacher see the name, photo and comment, so that a student can tell the teacher something without other students seeing it. Sign-in therefore asks Google for the profile as well as the email address. The photo is copied at sign-in and served by the site, because Google's photo addresses can change.

The teacher's lists show each student by name with the email address under it, and the name opens the student's details and comment.

The list of permitted addresses may carry each student's first and last name in English. The teacher asked for it so that his lists show the names students are known by in the course. A student who registers takes the names from the list, and the names from Google fill only what is missing. The upload form still reads only the email and group columns of a CSV file.

The 44 students of the HIT fall 2026 ASE course were added from the Moodle participants export, with their English names, email addresses and groups 62121-1 and 62121-2, under the institution HIT. The export gives each student a second group, 662121-1 or 662121-2, which was left out because it repeats the first. The Hebrew names were not imported. The export was read once in the pod and is not kept in the repository.
