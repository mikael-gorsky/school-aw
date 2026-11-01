# How School of Agentic Work works

School of Agentic Work (SAW) is the site that supports students of Mikael Gorsky's programs during live lessons and between them. A team of named AI agents runs parts of the work, and the teacher directs them and sets every grade.

## Signing in and registering

A student registers once with Google, using the email address they gave their course organizer. The site accepts only addresses on the teacher's list of permitted addresses, and it takes the institution, group and program from that list, so the student never enters them. If the site refuses an address, or the address is not a Google address, the student writes to the teacher through Contact SAW. The demo login is a sample student for people who want to see the site; everything entered under it is deleted every night.

## The parts of the site

- **My program** is the page a student sees after signing in. It shows the next lesson and its Zoom link, the student's group, the schedule of the group's meetings in Israel time (each marked held, today or coming), the description of the program, what the student will be able to do, the parts of the grade and how work is graded, the curriculum part by part and module by module, the projects and their rules, the course policies, the textbook and reading, and the documents.
- **Learn in class** is open beside the lecture, in class or on Zoom. Before the lecture a warm-up quiz opens; after each block of the lecture a short exercise opens with a timer. The student answers on a phone or laptop, and the teacher shows the class results. Answers count towards class engagement. After the lesson the student may rate it anonymously.
- **Study alone** lists the modules. Each module has a study page with an introduction, the key ideas, the reading in the textbook and practice exercises. Practice answers count towards no grade. The page also has @tutor, which answers questions from the course rules only, and passes a question it cannot answer to the teacher without the student's name.
- **Submit projects** is where the student links the public GitHub repository of each project. @reviewer checks the repository's structure and history: public access, a context file, commits spread over time, clear commit messages, tests, a record of the work with the agent, and a README. It explains every failed check. The check never grades; the teacher grades the work itself.
- **My progress** shows the student's own figures set against the average of the group: live exercises answered and their score, practice accuracy, modules studied and projects passing. Only the student sees their own figures.
- **My account** opens from the student's last name at the top right. It shows the photo and name from Google, which the student can correct, the email, institution, group and program, a comment that only the student and the teacher see, and Sign out.
- **Contact SAW** sends a message to the teacher, who answers by email.

## The Teaching Assistant

On every page a student sees a round button in the lower right corner, labeled "Teaching Assistant". It opens a chat that answers questions about the site, the course and the textbook, in the language the student writes in. A student may ask 20 questions a day. It does not know who the student is, but it knows today's date and the schedule of the student's group, so it can say what today's class covers and what to read before it.

## The agents

- @proctor runs the live lessons: it opens the warm-up quiz and the exercises after each block.
- @tutor answers questions about the course rules on Study alone.
- @reviewer checks project repositories on Submit projects.
- @analyst prepares the progress figures and the anonymous lesson ratings.
- @registrar checks every registration against the teacher's list.
- @steward passes messages from Contact SAW to the teacher.

Agents never grade, never add a person to a group and never change a rule on their own. Every decision about a person is the teacher's.

## Privacy

Lesson ratings and survey answers are anonymous: the teacher sees them only as totals from 5 or more students, and they never affect any grade. The site never asks for an ID number. Questions to the AI services go without the student's name or email address. The full privacy notice is on the site.
