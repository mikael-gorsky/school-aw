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

## First steps in the pod

Check the pod's live configuration, including the preview port. Clone github.com/mikael-gorsky/school-aw into the persistent workspace. Serve `mockup/index.html` on the preview port, so that the owner can confirm the preview works. Then set out the plan of work to the owner before writing application code, as CLAUDE.md requires.
