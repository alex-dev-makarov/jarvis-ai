---
description: Cross-branch overview — what's in flight on every branch at once. Read-only, writes nothing.
---

@~/.claude/skills/jarvis/ledger/ledger-location.md

Read-only report across ALL branches' ledgers. Nothing here writes.

## 1. Resolve the ledger root, list branches that have one

```bash
ROOT=$([ -d .jarvis-ledger ] && echo .jarvis-ledger || echo docs/jarvis)
ls -d "$ROOT"/*/ 2>/dev/null | sed "s|$ROOT/||;s|/||"
git rev-parse --abbrev-ref HEAD 2>/dev/null
```

If the root doesn't exist or has no subdirectories → say so and stop
("no branch-scoped ledgers yet — run /jarvis:advance to create one").

## 2. Count per branch — grep only, never read a file in full

`tasks.md` is a table (tasks-schema.md), and a Status cell holds either a
marker (`[ ]`) or a word (`planned`) depending on who wrote the row — so
match both, and anchor on the PR column so the Milestones table's own
Status column isn't counted twice:

```bash
for d in "$ROOT"/*/; do
  b=$(basename "$d")
  p=$(grep -cE '^\| *PR-[0-9]+ *\| *(\[ \]|planned)' "$d/tasks.md" 2>/dev/null || echo 0)
  w=$(grep -cE '^\| *PR-[0-9]+ *\| *(\[~\]|in progress|wip)' "$d/tasks.md" 2>/dev/null || echo 0)
  x=$(grep -cE '^\| *PR-[0-9]+ *\| *(\[x\]|done)' "$d/tasks.md" 2>/dev/null || echo 0)
  o=$(grep -c '^\*\*Status:\*\* open' "$d/defects.md" 2>/dev/null || echo 0)
  q=$(grep -c '^\*\*Status:\*\* asked' "$d/questions.md" 2>/dev/null || echo 0)
  echo "$b|$p|$w|$x|$o|$q"
done
```

This command exists to be cheap — reading every branch's whole ledger
would cost more context than just running `/jarvis:status` per branch.

## 3. One table

```
── All branches ──────────────────────────────────────────────
Branch                  Planned  WIP  Done  Defects  Questions
feat-auth-otp ←current        3    1     8        2          0
feat-i18n                     0    0    12        0          1
──────────────────────────────────────────────────────────────
```

Mark the current branch. Sort by activity (WIP first, then planned).

## 4. Flag only what needs the user — skip quiet branches

```
⚠ feat-auth-otp — 2 open defects, 1 task [~] left mid-flight
⚠ feat-i18n — 1 unanswered question blocking the plan
```

If a ledger directory's git branch is gone (`git branch --list <name>`
empty), report it as orphaned — never auto-delete:

```
ℹ <root>/old-feature/ — branch no longer exists, ledger orphaned
```

Note the slug is the branch name with `/` → `-` (ledger-location.md), so
check the original name too before calling a directory orphaned — a slug
`feat-auth-otp` may come from a live branch `feat/auth-otp`.

## 5. Shared history, one line

```bash
grep -c '^## PR' docs/completed-log.md 2>/dev/null || echo 0
```

```
Shipped across all branches: N PRs (docs/completed-log.md)
```

## Does NOT

- Write or modify anything — pure read
- Read any ledger file in full — grep counts only
- Switch branches or run git checkout
- Auto-clean orphaned directories — reports them, user decides
