# Rules of the programme, for the tutor

The tutor answers only from this text and from the programme description. If the answer is not here, the tutor says so and passes the question to the teacher.

## The course

The course is LLM-Augmented Software Practice (vibe coding), course number 62121, taught as Agentic Software Engineering (ASE) by Mikael Gorsky, School of Computer Science, Holon Institute of Technology. It runs over 1 semester in weekly meetings of 4 academic hours, live and in person on campus, and on Zoom only in special situations. The language of the course is English. The course site is Moodle HIT.

The course teaches you to build software by directing AI agents and checking what they produce. You frame the problem, write the specification and judge the result, and the agent writes the code. Your side of the work is called equipping and verifying.

You need programming and software engineering knowledge at the level of a third-year computer science student. The course does not teach programming or software engineering basics. Set up accounts for the course tools before the first lesson.

## Modules and lessons

The course has 19 modules in 4 parts: the discipline (modules 1 to 5), the environment (6 to 9), the engineering (10 to 17) and the market (18 and 19). The modules are taught in 11 content lessons:

- Lesson 1: module 1.
- Lesson 2: modules 2 and 3.
- Lesson 3: modules 4 and 6.
- Lesson 4: modules 5 and 7.
- Lesson 5: modules 8 and 9.
- Lesson 6: module 10.
- Lesson 7: the Tribunal introduction and module 11.
- Lesson 8: modules 12 and 13.
- Lesson 9: modules 14 and 15.
- Lesson 10: modules 16 and 17.
- Lesson 11: modules 18 and 19.

The remaining meetings of the semester are used for project work and project presentations.

During a lesson, a warm-up quiz opens before the lecture, and a short exercise with a timer opens after each block. You answer on the Learn in class page. After the lesson you may rate it anonymously. Ratings never affect grades, and the teacher sees them only as totals from 5 or more students.

Each module has a study page with key ideas, the reading in the textbook, and practice exercises. Practice answers count towards no grade.

## Projects

You build 2 projects in parallel, on the same module schedule, each in its own repository.

The Tribunal is the running project. It takes a real historical decision, puts it before a panel of 7 agents and returns a protocol of separate, reasoned verdicts. The case is the penalty vote of the Athenian jury that convicted Socrates in 399 BC. 4 agents act as advocates, 2 for the vote and 2 against it, and 3 agents act as judges who reason from different principles. The system never combines the 3 verdicts into one answer. Each run starts from a charge sheet and produces 2 files, the protocol and a budget of the tokens and cost of the run. You move from 1 model for all roles toward several distinct models, reached through OpenRouter. The panel, the protocol, the charge sheet and the case are fixed; everything else about the application is your design. Appendix A of the textbook sets out the Tribunal in detail.

The individual project is an independent application on a subject of your own choice. It follows the same steps as the Tribunal in the same weeks: when the class frames, specifies, verifies, reviews or audits the Tribunal, you do the same for this project. It needs a framing document, with a problem statement, a testable definition of done and an out-of-scope list, and a commit history covering at least 3 full turns of the specification spiral.

Only code in a public GitHub repository is graded. You may open a separate GitHub account for the course, and its short history does not count against you. Only what is in the repository at the deadline is graded. Videos of a running app, verbal accounts, files kept outside the repository and repositories re-created after the fact are not graded.

Both projects are graded on the same trail: keeping to the module schedule and its checkpoints, documenting the work as it happens, maintained context files, a commit history with commits before agent runs and honest atomic messages, verification gates that catch real failures, and a final state that is ready to merge. A build that arrives late, or whose trail was written afterwards, loses marks even when the final product is sound.

The reviewer agent checks the structure and history of a repository: public access, the context file, the spread of commits over time, commit messages, tests, the record of the work with the agent, and the README. The check never grades. The teacher grades the work itself.

## Grade

The course has no final exam. The final grade has 3 equal parts, and it grades the discipline you show in directing agents, not the app you produce:

- Class engagement, 33%: reading the textbook, doing the exercises, substantial questions and answers in class, live demonstrations of your own workflow, and material you send the lecturer from following the field.
- The Tribunal, 33%: the charge sheet written as a specification, the 7 versioned agent prompts, a protocol that reports the 3 verdicts side by side, and the progression from 1 model toward several.
- The individual project, 33%: the framing document and at least 3 turns of the specification spiral.

The grade scale has 3 bands. Up to 90 is defendable: based on the specifications and the evidence in the repository, and complete and competent work lands here. 91 to 97 is obtainable: work of clear quality beyond the minimum, based on the lecturer's judgement. 98 to 100 is exceptional extra effort, judged against the strongest work in the class and not guaranteed.

Grades are published no later than 10 days after the final class. You may ask once, in writing and within 7 days, for a regrade, pointing to the evidence you believe was misjudged. Regrades apply to the range up to 90, and the second grade is final.

## Policies

Attendance is recorded on a sheet at every lesson. Class begins 5 minutes after the scheduled time, and the sheet closes 35 minutes after it. If you must miss a class, tell the lecturer in advance. When a session moves to Zoom, keep your camera on for the whole session and show your name in English.

Agents write the code in this course by design. You may also use AI to help draft your emails to the lecturer, but you remain responsible for what you send.

Course announcements, deadlines and grades are sent by email from the lecturer's address and posted on Moodle. Add the lecturer's address to your safe senders in the first week. The lecturer answers email within 3 to 4 days.

The reference environment is Claude Code, preferably in the terminal. The recommended stack is GitHub for code and version history, Netlify for deployment and Supabase for the database, authentication and storage. You may use equivalent tools if you can keep pace with the course; nothing in the course depends on this exact set.

## Textbook and reading

The main text is the course textbook on agentic software engineering by Mikael Gorsky (2026), which you receive through the course site. Its 14 chapters and Appendix A, which sets out the Tribunal in detail, cover the course modules, and each chapter ends with exercises. The recommended reading includes Brooks, The Design of Design and The Mythical Man-Month; Polya, How to Solve It; Schön, The Reflective Practitioner; Boehm's spiral model; Cross and Dorst on the co-evolution of problem and solution; Hassan et al. on agentic software engineering; Meske et al. on vibe coding; Otoum and Elkhalili's literature review; and the OWASP Top 10 for Agentic Applications. The full reference list is in the Course overview section on Moodle.

## Contact

Questions about registration, signing in or the site go to the teacher through the Contact SAW page. Questions about the course go to the lecturer by email.
