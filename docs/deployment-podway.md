# Running SAW in a Podway pod

The site runs in the owner's Podway pod, whose preview address is territorial-mink-85a7.podway.site. This was decided on 31 October 2026. The rules below come from the Podway documentation at podway.io/docs.

## What the pod provides

A pod is a private cloud workspace in which Claude builds, runs and checks the project. Managed Podway exposes one application preview per pod. Claude chooses the port and the network binding inside the pod, so the application should run on the port that the pod's live configuration gives for the preview.

Preview visibility comes from the environment used to create the pod. A development pod starts as owner-only. The owner changes access on the pod page. A public preview exposes everything the application serves, so the site must have working sign-in before the preview is made public. Test the address in a signed-out browser before anyone else receives it.

Podway is in private alpha. The documentation asks Claude to check the live pod's capabilities before acting, so do that first in each new session.

## Processes and data

Running processes do not survive a restart on their own. Declare the web application and the database as services that Podway supervises, so that Podway relaunches them after a crash or a restart.

Files in the pod's home workspace survive restarts, suspension and image updates. Temporary files and changes to the operating system may not. Keep the database files and uploaded files in the persistent workspace.

The persistent workspace is not an independent backup, and deleting the pod deletes it. Push every source change to GitHub. Export the database on a schedule to a place outside the pod, and write down in this file where the exports go and how to restore one.

A suspended pod runs nothing, including scheduled work. The site is offline while the pod is suspended.

## Secrets

Only the owner adds or changes secrets, through the pod's Secrets panel. When the site needs a credential, such as the Google sign-in client or the Claude API key, record which credential is needed and why, ask the owner to add it in the panel, and continue once it is there. Never commit a `.env` file or a credential to Git, and never print a secret value in logs or in the conversation.

## Running the site in the pod

The site needs Node.js 22.13 or later and no packages. Check the Node version in the pod first. Clone github.com/mikael-gorsky/school-aw into the persistent workspace and run `npm test`.

Declare one service that Podway supervises. It runs `npm start` in the repository folder, with `PORT` set to the port of the pod's preview and `DATA_DIR` set to a folder in the persistent workspace. The database is a single SQLite file in that folder, so the site needs no separate database service.

Ask the owner to add these secrets in the Secrets panel: `SESSION_SECRET`, a long random string that must never change afterwards; `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, from a Google OAuth client of type "Web application" whose authorized redirect address is `https://territorial-mink-85a7.podway.site/auth/google/callback`; `TEACHER_EMAILS`, the addresses that sign in as the teacher; and `DEMO_PASSWORD`, the password of the demo login. `ANTHROPIC_API_KEY` turns on @tutor and the grouping of comments, and `GITHUB_TOKEN` raises GitHub's limit for repository checks. Set `BASE_URL` to `https://territorial-mink-85a7.podway.site`. Never set `DEV_LOGIN` in the pod.

Before the owner shares the address, test registration, sign-in and the demo login in a signed-out browser.

The site resets the demo group every night at 03:00 Israel time. A pod that is suspended at that hour resets the demo group in its first minute after waking.

## Backups

`npm run backup` writes a consistent copy of the database to `backups/` while the site runs. Copy each backup out of the pod. To restore one, stop the service, replace `saw.db` in `DATA_DIR` with the backup file, delete any `saw.db-wal` and `saw.db-shm` files beside it, and start the service again. Write down here where the copies go once that is set up.

## The helper and the textbook

The helper reads the course textbook from `textbook-ase.txt` in `DATA_DIR` (in the pod, `~/saw-data/textbook-ase.txt`). The file is the teacher's own book and is never committed, because the repository is public. Without the file the helper still answers from the site guide and the course content. The helper and @tutor need `ANTHROPIC_API_KEY`; `HELPER_MODEL` overrides the model, which is `claude-sonnet-5-5` by default.

## The service in this pod

The site runs as the Podway startup service `preview-3000`, which runs `~/saw-start.sh`. That script loads the secrets, unsets `DEV_LOGIN`, sets `PORT=3000`, `DATA_DIR=~/saw-data` and `BASE_URL=https://school.mgorsky.net`, and starts `node server/main.js`. Podway's own dev server is disabled. Restart the site with `podway startup restart preview-3000`.

## Spending alerts in the owner's chat

The Podway job `saw-ai-spend-alert` runs `~/ops/ai-spend-alert.mjs` every 15 minutes. It reads the spending totals from the database and, when a new $10 step has been crossed or the helper and @tutor have stopped, it exits with an error that carries the alert, because Podway reports a scheduled job to the owner's chat only when it fails. It remembers what it has reported in `~/ops/ai-spend-alert.state.json`. The script lives outside the repository; list the job with `podway schedule list`.
