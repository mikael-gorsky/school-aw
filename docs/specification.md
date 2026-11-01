# School of Agentic Work: specification

Status: agreed design, 31 October 2026. The clickable mockup in `mockup/index.html` shows every page described here. Items in square brackets, such as [date] or [%], are values that the owner has not set yet.

## 1. Purpose

School of Agentic Work (SAW) supports students who are enrolled in programs taught by Mikael Gorsky. It serves them during live lessons, in class or on Zoom, and between lessons. It does not offer programs to the public, and it holds information only about programs that have active students.

The site has a second purpose. It shows potential clients of the teacher how deep the support of his programs is. These clients come in 2 kinds. Some open the site from a link and do not sign in. Others ask the teacher for the demo login and use the site as a sample student.

The site therefore follows one rule of communication. Every page addresses the student. A visitor who has not signed in sees every part of the site in a general form, and nothing is hidden behind a lock. After sign-in, the same pages show the student's own lessons, answers, checks and figures.

## 2. Users and access

| User | How the user enters | What the user sees |
|---|---|---|
| Visitor | Does not sign in. | The general form of every page, with example screens that cannot be used. |
| Student | Registers once, then signs in with Google or with a link sent by email. | The student's own program and all 4 sections with the student's own data. |
| Demo user | Signs in with the login "demo" and a password that the teacher gives out. | The student side of the SAW demo group. Nothing entered is kept. |
| Teacher | Signs in with the teacher's account. | The teacher pages: the 4 sections from the teacher's side, class progress, satisfaction, groups and access, and the agents. |

### 2.1 Registration and the list of permitted addresses

The teacher keeps a list of permitted addresses. Each address on the list carries an institution name, a group number and a program. The teacher adds addresses by pasting them, one per line, with the institution, group and program for the whole batch, or by uploading a CSV file. When the site reads a CSV file, such as a Moodle export, it reads only 5 columns: first name, last name, email, group and institution. It never imports ID numbers. Where a file has names in 2 languages, as a Moodle export does, the English columns are read. A group or institution in the file overrides the one written in the form. The names may be left out, and then they come from the student's Google account at sign-in. A name from the list comes before the name from Google.

The page "Register to use the service" tells the student to register with the email address given to the course organizer, preferably a Gmail address. A Gmail address registers with Google. Any other address registers through a link sent to it by email. The site accepts only an address on the list. When it accepts one, it tells the student the institution, group and program in which it has placed them. The student never enters these values.

When an address is not on any list, the site refuses the registration, tells the student to check the address or write to Contact SAW, and shows the attempt to the teacher on the Groups and access page. The teacher can add the address to a group or ignore it.

After registration, the student signs in with the same address.

### 2.2 The demo login

A demo login is a sample student of a demo group. The login "demo" belongs to the group "demo" of the institution "SAW demo", in the program Agentic software engineering. It has a password, which the teacher can change. A demo login for another program can be added once that program has content on the site.

A demo user sees only the student side. A line under the header says that the user is signed in as demo, that nothing is saved, and that the demo group is reset every night. A demo user can never open a teacher page. The site records when the demo login is used and which pages are opened, and it deletes everything entered under it every night.

People ask for the demo login through Contact SAW.

### 2.3 Contact SAW

Contact SAW is a form with a name, an email address, a topic and a message. The topics are "Registration and signing in", "My program" and "Something else". The steward agent passes each message to the teacher's Groups and access page, where the teacher replies by email or sends the demo login. The form asks people not to send ID numbers or other personal documents.

## 3. Structure of the site

The main menu has 4 sections: Learn in class, Study alone, Submit projects and Exam finale. Each section is run by one agent under the teacher.

A signed-in student also has 2 personal pages, My program and My progress, which appear beside the main menu. My program is the page a student sees after signing in.

Every signed-in user, the teacher included, sees their last name and status beside the main menu, for example "Gold · student". It opens My account, which also holds Sign out.

The school pages are Home, The agents, Contact SAW, Privacy notice, Sign in and Register to use the service.

The teacher sees the 4 sections from the teacher's side, and 4 further pages: Class progress, Satisfaction, Groups and access, and Agents.

On a phone, the 4 sections sit in a tab bar at the bottom of the screen, and all other pages are in the menu. The layout changes at 2 widths: tablet from 641 to 1024 pixels, and phone up to 640 pixels.

| Page | Visitor | Student and demo user | Teacher |
|---|---|---|---|
| Home | What the student does on the site, the agents, the teacher, Contact SAW. | The same, with links to My program and My progress. | The same. |
| My program | How the site finds the student's group, and an example overview. | The student's program, group, next lesson, grade parts, curriculum and documents. | The program overview. |
| Learn in class | How a lesson runs, an example exercise and an example rating. | The live exercise, the lesson plan, the lesson rating and the student's lessons. | The live lesson console. |
| Study alone | How studying works, an example study page and an example question to the tutor. | The modules with practice results, the tutor and suggestions. | Practice results of the class and questions the tutor could not answer. |
| Submit projects | How checks work, an example check and the list of checks. | Repository links, check results, feedback and project rules. | Checks of all students and the most common failed checks. |
| Exam finale | How the exam works, an example readiness card and the exam format. | The student's readiness, practice exams and the rules for the exam day. | Readiness of the class, the exam draft and the exam settings. |
| My progress | What the page shows, with an example. | The student's figures against the average of the group. | Class progress. |
| My account | What the page shows, with an example. | The student's photo and name, email, institution, group, program and comment, and Sign out. | The teacher's own name, photo, comment and Sign out. |

## 4. Pages

### 4.1 Home

The home page opens with the name of the school and the sentence "This is where you work on your course, during lessons and between them." A visitor sees the buttons "Sign in" and "Register to use the service", and a line that sends first-time students to registration. A signed-in student sees "Go to my program" and "My progress".

The page continues with the 4 sections, each with the agent that runs it, a section about the student's program, progress and anonymous ratings, the 7 agents, the teacher, and a block that leads to Contact SAW.

### 4.2 My program

The page shows the program name, the institution, the group and the teacher. It shows the next lesson with its date, a button to Learn in class and the Zoom link. It shows the student's group as the site recorded it, the description of the program, the parts of the grade with their weights, the schedule of the student's own group, with the date, the time in Israel and the content of each meeting and whether it is held, today or coming, the full curriculum with the status of each module, the documents (the program 2-pager, the full curriculum, the project rules and the grading rules) and a way to contact the teacher.

### 4.3 Learn in class

A lesson runs in 4 steps. Before the lecture, the proctor agent opens a warm-up quiz on the last lesson. After each 15-minute block, the proctor opens a short exercise with a timer, and the student answers on a phone or laptop. The teacher shows the answers of the class and discusses them. After the lesson, the student rates the lesson in about 20 seconds.

The student sees the open exercise with its timer, the plan of the lesson with the state of each item, the Zoom link, a link to the study page of the module, the rating form and a table of the student's lessons with answers, score, group average and the student's own rating.

The teacher sees the lesson plan, the open exercise with its timer, the answers as they arrive, the share of correct answers, the number of students who have not answered, and buttons to show the results to the class, close the exercise, add 1 minute and release the next item. The proctor never releases an exercise without the teacher.

### 4.4 Study alone

Each module has a study page with its key ideas, the slides, the recording of the lesson, 3 practice exercises and a clarity rating. Practice answers show at once whether they are right, are kept for the student only and count towards no grade. A short-answer exercise lets the student compare an own answer with the teacher's answer.

The tutor agent answers questions about the course rules, the lessons and the site, up to 20 questions a day for each student, and names the source of each answer. It suggests what to review before the next lesson. It never writes project code for a student and never sees grades. Questions it cannot answer from the rules go to the teacher, who can answer them and add the answer to the rules.

The teacher sees practice accuracy by module, the number of practice sessions and questions, the most asked topics and the questions passed on by the tutor.

### 4.5 Submit projects

In ASE a student builds 2 projects, an own project and the Tribunal. For each project the student submits the link to a public repository, and the reviewer agent checks it. The check covers 7 points: the repository is public; a context file (CLAUDE.md) is in the root folder; the work is spread over time; commit messages say what changed; tests exist; a record of the work with the agent is kept in the repository; the README explains how to run the project. Each point passes, gives a warning or fails, and each failed point comes with an explanation and written feedback. The student can run the check again at any time and sees the history of checks.

The check never grades. The teacher grades the work itself.

The teacher sees how many projects are submitted and passing, the most common failed checks, a note from the reviewer and a table of all students with the state of both projects.

### 4.6 Exam finale

A program without a final exam sets `"exam": false` in its `programme.json`. Its students, the teacher's view of its groups and the visitor's view of the site then show no Exam finale, no exam readiness and no @examiner. ASE has no final exam, so the section below applies only to a program that has one.

The exam format below is a draft for the owner to correct.

The examiner agent follows each student's readiness against 6 conditions: the modules taught so far are studied; at least 80% of live exercises are answered; practice reaches 70% in each part; the own project passes every check; the Tribunal is submitted and passes every check; at least 1 practice exam is taken. Practice exams have 20 questions on the modules taught so far, take about 30 minutes and never count towards the grade.

The exam has 2 parts. Part A has closed questions on all modules, marked by the examiner and reviewed by the teacher. In part B the student directs an agent on a small task and submits the record of the session, which the teacher grades. The tutor is closed during the exam.

The teacher sees readiness of the class, the draft of part A prepared by the examiner, the conditions and the exam settings: date, length and the weights of the 2 parts.

### 4.7 My progress

The student sees 6 figures: live exercises answered, live exercise score, practice accuracy, modules studied, projects passing and exam readiness. The page also shows the score in each lesson against the group average (with a table view), messages from the agents about what to do next, the state of each module, the answers in each lesson, and the student's own lesson ratings beside the group average. Only the student sees these figures.

### 4.7b The Teaching Assistant

Every page shows students and the demo login a round button with a drawn icon of an Ethiopian woman professor in glasses, labeled "Teaching Assistant", above the "Made with Podway" badge in the corner. The same icon is the site's favicon. It opens a chat that begins "How can I help?". The helper answers questions about the site, the course and the textbook in the language the student writes in, in detail and in simple words, and names the textbook chapter it draws on. When the material does not settle a question about the course, it says so and points to Contact SAW. With each question it gets today's date and time in Israel and the schedule of the student's group, by group code only, so it can say what today's or the next class covers and what to read for it. It never grades, never decides about a person, and does not write a student's project code. A student may ask 20 questions a day; the demo login's limit is counted per visitor. The conversation stays in the browser tab, and no name or email address is sent.

### 4.7a My account

The page shows the user's photo, first name and last name, which come from the Google account at sign-in. The user can change both names freely. A name from the teacher's list or from Google fills a name only until the user saves My account; after that the user's own name always stays, even if it is empty. The site copies the photo at each sign-in and serves it itself. The page also shows the email address and, for a student, the institution, group and program from the teacher's list, which the student cannot change. A comment field of up to 2,000 characters holds anything the student wants the teacher to know. Only the user and the teacher see the name, photo and comment; other students never see them. The page holds Sign out.

The teacher's lists show each student by name, with the email address under it, and the name opens the student's details and comment, read-only.

### 4.8 Class progress (teacher)

The teacher sees the same figures for the class, the share of exercises answered and the average score per lesson, the distribution of students by engagement, the share of students who studied each module, a table of all students with a filter for flagged students, and a CSV export for Moodle with 2 columns, the email address and the engagement figure.

The analyst agent flags a student who has not registered, who answers fewer than 60% of live exercises, whose engagement is falling while the own project does not pass, or who has submitted no project and is behind on modules. The analyst never messages a flagged student. The teacher decides whether to send a message.

### 4.9 Groups and access (teacher)

The page shows each group with its institution, program and the numbers of permitted and registered addresses, and the demo group. It holds the form for permitting addresses, the CSV upload, the list of permitted addresses with the state of each, refused registrations, the demo logins with their last use and a way to change the password, and the messages from Contact SAW.

### 4.10 Agents (teacher)

The page lists what waits for the teacher's decision, what each agent may do alone and what it must ask first, how many actions each agent took today, and a log of the day.

## 5. The agents

| Agent | Role | Works in | Does | Never does |
|---|---|---|---|---|
| @steward | Coordinator | Every part of the school | Assigns work to the other agents, checks that tasks are finished, passes messages from Contact SAW to the teacher and prepares the teacher's daily brief. | Changes a grade, a rule or a group list. |
| @registrar | Access | Registration and sign-in | Checks each registration against the list of permitted addresses and places each student in the right institution and group. | Adds an address to the list. |
| @proctor | Live lessons | Learn in class | Opens the warm-up quiz, releases exercises when the teacher says, times them, records answers and shows class results. | Releases an exercise without the teacher. |
| @tutor | Self-study | Study alone | Guides students through study pages and practice, answers questions from the rules and the materials, and suggests what to review. | Writes project code for a student or sees grades. |
| @reviewer | Project checks | Submit projects | Checks repositories and explains every failed check. | Grades. |
| @examiner | Final exam | Exam finale | Tracks readiness, runs practice exams and the exam session, and marks closed questions. | Sets a final mark, publishes an exam or changes the conditions. |
| @analyst | Progress and satisfaction | My progress and the teacher's reports | Collects ratings and survey answers, shows each student their progress, shows the teacher the class and groups comments into themes. | Shows ratings from fewer than 5 students, or lets ratings affect grades. |

## 6. Measuring satisfaction

### 6.1 What the site asks

After each lesson, the analyst opens a lesson rating. The student gives a rating from 1 to 5, may mark what helped (live exercises, examples, slides, pace, questions and answers) and what got in the way (too fast, too slow, unclear slides, sound or video, too much at once), and may add a comment. The rating takes about 20 seconds.

At the end of each study page, the student may rate the clarity of the module from 1 to 5.

Twice in each program, at the start and in the middle, the student answers a survey of 6 dimensions, each from 1 to 5: clarity, pace, usefulness for work, interest, support from agents and manageable workload. The survey also asks whether the student would recommend the course, on a scale from 0 to 10.

### 6.2 Rules

All answers are anonymous to the teacher. The teacher sees results only as totals from 5 or more students. No answer affects any grade. Each student sees their own ratings beside the group average.

### 6.3 The teacher's report

The report shows a satisfaction index from 0 to 100, which rescales the average lesson rating: (average − 1) ÷ 4 × 100. It shows the average rating of each lesson against the course average, and the response rate for each lesson. A lesson with a response rate below 60% is marked as uncertain.

It shows each dimension of the latest survey beside the result of the first survey. It shows the importance of each dimension, measured as the correlation between that dimension and the overall rating, plotted against the dimension's average score. The dimensions with a score below 4.0 and an importance above 0.5 are marked "fix first".

It shows the clarity, pace and usefulness ratings of each module as a grid of shaded cells. It shows the recommend score, which is the percentage of students who answered 9 or 10 minus the percentage who answered from 0 to 6, with the distribution of all answers. It shows the themes of the written comments, grouped by the analyst, with the number of comments, the tone and an example comment for each theme.

Each week, the analyst writes a short list of findings at the top of the report.

## 7. Privacy and data

Mikael Gorsky runs the site and is responsible for the data it keeps. The privacy notice on the site states the following.

The site keeps the email address a student registers with, and the institution, group and program written beside it on the teacher's list. It keeps the student's answers to exercises, project links and their checks, and messages sent through Contact SAW. When a user signs in with Google, the site also keeps the first and last name and the profile photo from the Google account, and the comment the user writes on My account. Only the user and the teacher see them. The site never asks for an ID number.

Ratings and survey answers are anonymous to the teacher, as described in section 6.2.

Questions to the tutor go to an AI service without the student's name or email address, and students are asked not to write personal matters in them. The site runs on [hosting service] in [region].

Course data is deleted [period] after the end of the course, once the time for grade appeals has passed.

A student who does not want to use the site can do the lesson exercises in another way, for example by email to the teacher.

The demo login belongs to no person, and section 2.2 describes what the site records about it.

## 8. Design

The design follows the "Console" direction shown in the mockup. The ground is dark (#0D1117), with surfaces in #161B22 and lines in #30363D. Text is #E6EDF3, with secondary text in #C9D1D9 and muted text in #9DA7B3. The accent is green (#3DDC97). Yellow (#F2CC60) marks warnings, sample content and the demo line. Red (#FF7B72) marks failures.

Text and headings use Manrope. Labels, prompts, agent names and figures in tables use JetBrains Mono. Agent names always appear as @name with a small green square.

Example screens shown to visitors sit in a frame with a dashed yellow border and the label "example screen", and they cannot be used. Sample data carries a yellow "sample data" mark.

## 9. Open questions

The region where the pod stores data.

The email service for sign-in links.

The weights of the grade parts, the lesson dates, the exam date, length and conditions, and the period for which course data is kept.

Whether the repository becomes public as a worked example of the course method.

The content of the study pages and exercises for modules 2 to 19.
