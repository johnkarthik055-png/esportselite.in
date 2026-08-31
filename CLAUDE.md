# Project Rules — Esports Elite

## Auto-Deploy Policy

After completing ANY code change task,
ALWAYS automatically run these commands
without asking for confirmation:

  git add .
  git commit -m "<short descriptive
    message summarizing what changed>"
  git push origin main

This applies every time, whether the
request comes from desktop or mobile
remote control. Do not wait for the
user to say "push it" — push
automatically as the final step of
every task, unless the user explicitly
says "don't push" or "just show me
first" for that specific request.

## Project Log Entry

### Why this is a report block, not an auto-write

Claude Code has **no way to write to the
`projectLog` Firestore collection** from
its session:

  - No Firebase Admin SDK service-account
    key, no GOOGLE_APPLICATION_CREDENTIALS,
    no `gcloud` / application-default
    credentials in the environment.
  - The `firebase` CLI is logged in, but
    firebase-tools exposes no command to
    write an arbitrary Firestore document
    (there is no `firestore:set`).
  - The `projectLog` security rule requires
    `request.auth.token.email` to be an
    admin email — that is a Firebase Auth
    ID token from a browser sign-in, which
    a CLI session does not have.
  - Nothing server-side (no Cloud Function)
    writes `projectLog` either — the app
    only writes it from an authenticated
    admin browser session (ProjectLogTab).

The old version of this rule told Claude to
"write one entry to the `projectLog`
Firestore collection automatically." That
was never executable, so entries silently
never landed. Corrected process below.

### What Claude does now

After completing any code change task,
**end the task report with a
copy-paste-ready PROJECT LOG ENTRY block**
in exactly this format:

  ---
  PROJECT LOG ENTRY
  type:        idea | bug | completed
  title:       <short summary of the task>
  description: <fuller explanation of what
               was found / done>
  relatedArea: <e.g. Map Knowledge,
               Strategy Maker, Match Logger,
               Admin Panel, AI Coach>
  status:      open | in_progress | done
  ---

Field meanings:

  type   = 'bug' (fixing a reported issue),
           'completed' (feature/change
           successfully implemented),
           'idea' (suggestion/plan not yet
           acted on).
  status = 'done' (fully completed and
           verified), 'in_progress' (partly
           done or pending verification),
           'open' (not started).

Karthik pastes this into **Admin Panel →
Project Log → "+ Add Entry"**. Entries
added that way are tagged
`createdBy: 'karthik'` by the form; that
is expected — there is currently no
`claude_code` write path.

If a task produced no code change (pure
investigation / advice), still emit the
block with `type: idea` or `type: bug` so
the decision is logged.

### Optional future upgrade (not set up)

To make this a true auto-write, add the
Firebase Admin SDK to a small local
tooling script with a **gitignored**
service-account key
(`serviceAccountKey.json`), or deploy an
admin-only callable Cloud Function
(`logProjectEntry`) once the Functions
project is live on Blaze, and have Claude
call it. Until one of those exists, use
the report block above.

Collection shape (top-level `projectLog`),
for reference:
  { type, title, description, status,
    relatedArea, createdAt, updatedAt,
    createdBy }
  type    = 'idea' | 'bug' | 'completed'
  status  = 'open' | 'in_progress' | 'done'
  createdBy = 'karthik' | 'claude_code'

## What Gets Pushed

Only source code changes get pushed:
  src/**
  public/*.html
  package.json
  package-lock.json
  tailwind.config.js
  vite.config.js
  index.html
  .github/workflows/**

## What NEVER Gets Auto-Deployed

The GitHub Actions deploy workflow
(.github/workflows/deploy.yml) already
excludes these from the Hostinger FTP
upload on every deploy:
  **/tiles/**        (map tile images)
  **/.git*
  **/.git*/**
  **/node_modules/**

If new large binary asset folders are
ever added (weapon images, attachment
images, new map tiles, video files),
ADD them to the exclude list in
.github/workflows/deploy.yml as well,
so they are committed to git (for
version history) but never re-uploaded
via FTP on every deploy — since these
are large, static, and already live
on the Hostinger server once uploaded
manually.

Current known asset folders to keep
excluded from FTP re-upload:
  public/weapons/**
  public/attachments/**
  public/maps/**  (if map tiles live here)
  public/tiles/**

## Commit Message Style

Keep commit messages short and specific,
e.g.:
  "fix sidebar drawer not opening on mobile"
  "fix start training button double click"
  "constrain map pan to bounds"

Not generic messages like "update" or
"changes".
