# Ledger Location

Where every ledger file lives. Read this before the FIRST ledger read or
write in a session, and re-resolve the branch slug before EVERY write
(see "Re-resolve before every write" below).

## Why branch-scoping exists

Two branches working at once share one `docs/tasks.md` and immediately
corrupt each other: `feat-auth`'s PR-03 lands in the same table as
`feat-i18n`'s PR-03, the loop picks up the wrong `[ ]`, and a reviewer
gets a diff that has nothing to do with the task it was briefed on. The
fix is boring — give each branch its own directory.

## Resolve the ledger root — worktree if present, else in-repo

```bash
[ -d .jarvis-ledger ] && echo .jarvis-ledger || echo docs/jarvis
```

Two supported layouts, same branch-scoping inside either:

**`docs/jarvis/` (default).** Plain directory in the working tree. Zero
setup. Gitignore it (`echo 'docs/jarvis/' >> .git/info/exclude`) so it
stays local and never merges into code branches.

**`.jarvis-ledger/` (opt-in worktree).** A git worktree pinned to an
orphan branch `jarvis-ledger`. The ledger is versioned but lives on a
branch no code branch ever merges — so it never pollutes `main`, never
conflicts, and stays put when you `git checkout` in the main worktree
(a separate worktree doesn't follow the main one's branch). Costs a
one-time setup per clone; if someone skips it, the resolver silently
falls back to `docs/jarvis/` rather than failing.

Prefer whichever exists. Never create `.jarvis-ledger/` yourself — that's
an explicit user setup step, not something to improvise mid-session.

## Resolve the branch slug

```bash
git rev-parse --abbrev-ref HEAD | tr '/' '-' | tr '[:upper:]' '[:lower:]'
```

`feat/auth-otp` → `feat-auth-otp`. If the command prints `HEAD` (detached)
or fails (not a git repo), use the slug `no-branch` — the loop still works,
it just isn't scoped to anything.

## Branch-scoped paths

```
<ledger-root>/<branch-slug>/tasks.md
<ledger-root>/<branch-slug>/defects.md
<ledger-root>/<branch-slug>/questions.md
<ledger-root>/<branch-slug>/drafts/YYYYMMDD-HHMM-<name>.md
<ledger-root>/<branch-slug>/perf-findings/YYYYMMDD-HHMM-<slug>.md
<ledger-root>/<branch-slug>/qa-findings/YYYYMMDD-HHMM-<slug>.md
.jarvis/<branch-slug>/session-log.md
```

Create the directory on first write (`mkdir -p`).

## What stays SHARED (not branch-scoped)

```
docs/completed-log.md     — shipped history, append-only, spans all branches
docs/archive/             — closed milestones
research/perf-patterns.md — reference data, read-only
jarvis.context.md         — project rules
```

Why these don't scope: they're history and configuration, not work in
flight. A PR that shipped on `feat-auth-otp` is part of the project's
record once merged — splitting that per branch would mean the record
disappears the moment the branch is deleted.

## Re-resolve before every write

A session can outlive a `git checkout`. Re-run the slug command before
each ledger write, not just once at session start. If the slug differs
from what O0 resolved: **stop, write nothing to either path**, name both
branches, and ask which one to continue on. Silently continuing writes
one branch's work into another branch's ledger — the exact failure this
file exists to prevent.

## Migrating an existing flat ledger

If `docs/tasks.md` exists at the old unscoped path and the branch-scoped
one does not, say so once and offer to move it to the current branch's
directory. Never move it silently — the user may have meant it as a
shared backlog.
