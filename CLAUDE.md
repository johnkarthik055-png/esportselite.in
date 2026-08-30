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

## Project Log Auto-Entry

After completing any code change task,
in addition to the auto-commit/push
rule above, also write one entry to the
`projectLog` Firestore collection
summarizing the work. Do this
automatically, without being asked —
same standing behaviour as auto-push.

Set the fields as follows:

  type:         'bug' if the task was
                fixing a reported issue,
                'completed' if it was a
                feature/change that was
                successfully implemented,
                'idea' if the task was
                purely a suggestion or
                plan not yet acted on.
  title:        short summary of the task.
  description:  fuller explanation of
                what was found / done.
  relatedArea:  the relevant part of the
                app, free text, e.g.
                'Map Knowledge',
                'Strategy Maker',
                'Match Logger',
                'Admin Panel'.
  status:       'done' if fully completed
                and verified, 'in_progress'
                if only partially done or
                still pending verification.
  createdBy:    'claude_code'
  createdAt:    current server timestamp
  updatedAt:    current server timestamp

Collection shape (top-level `projectLog`):
  { type, title, description, status,
    relatedArea, createdAt, updatedAt,
    createdBy }
  type    = 'idea' | 'bug' | 'completed'
  status  = 'open' | 'in_progress' | 'done'
  createdBy = 'karthik' | 'claude_code'

This log is surfaced in the Admin Panel
under the "Project Log" tab. Manual
entries added there by Karthik use
createdBy 'karthik'; only automated
entries use 'claude_code'.

If writing to Firestore is not possible
in the current session (no credentials
/ offline), note in the task report that
the projectLog entry still needs to be
written, rather than skipping it
silently.

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
