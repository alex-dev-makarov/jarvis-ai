---
description: Show current ledger state, recent agent timeline, and what's next.
argument-hint: "[timeline] — add 'timeline' to see full session history"
---

@~/.claude/skills/jarvis/ledger/questions-schema.md

Read `docs/tasks.md`, `docs/defects.md`, `docs/questions.md`, and
`.jarvis/session-log.md` from the current directory (create empty mental
model if any are missing).

## 1. Ledger summary

```
── Jarvis Status ──────────────────────────────
Tasks:
  [ ] planned:      N
  [~] in progress:  N
  [x] done:         N
  [!] blocked:      N

Defects:
  open:         N
  wip:          N
  resolved:     N
  inconclusive: N
  wontfix:      N
  declined:     N

Questions:
  asked (unanswered): N
  answered:            N

Predicates:
  P-plan    (planned tasks > 0):    true/false
  P-execute (wip tasks > 0):        true/false
  P-review  (open defects > 0):     true/false

Loop state: DRAINED | RUNNING | BLOCKED-ON-QUESTIONS | BLOCKED
───────────────────────────────────────────────
```

If any question in `docs/questions.md` has `Status: asked` (no answer
yet) — list them explicitly right after the summary block:

```
⚠ Unanswered questions:
  [Q-03] Client-side or server-side pagination?
    a) Client-side  b) Server-side  c) Other
```

This is the most actionable thing `/jarvis:status` can surface — an
unanswered question is very likely why the loop looks stalled.

## 2. Recent agent timeline

Read `.jarvis/session-log.md`. Show the last 8 entries as a compact table —
this is the "who did what, where, and what's next" view:

```
── Recent Activity ────────────────────────────────────────────
Time   Agent      Task    Files                          Next
14:35  PLANNER    —       (investigated 8 files)         wrote docs/tasks.md
14:40  EXECUTOR   PR-01   ProductList.tsx (+)            REVIEWER
14:45  REVIEWER   PR-01   ProductList.tsx (ro)           revise: 2 defects
14:48  BUGFIXER   PR-01   ProductList.tsx (~)            REVIEWER re-check
14:52  REVIEWER   PR-01   ProductList.tsx (ro)           go-ahead ✓
14:53  EXECUTOR   PR-02   usePagination.ts (+)           REVIEWER
        ▶ CURRENTLY: EXECUTOR working on PR-02
────────────────────────────────────────────────────────────────
```

File tags: `(+)` created · `(~)` modified · `(ro)` read-only · `(-)` deleted

The last line (`▶ CURRENTLY`) reflects the most recent entry's "Next" field —
what is happening right now or what the loop will do next.

If `.jarvis/session-log.md` does not exist → print
"No session log yet — run /jarvis:advance to start."

## 3. Full timeline (only if $ARGUMENTS contains "timeline")

If the user ran `/jarvis:status timeline` → print the ENTIRE session-log.md
grouped by session, not just the last 8 entries.

## Closing line

- If any task is `[!]` blocked → print which one and the blocker
- If P-plan or P-execute is TRUE → "Run /jarvis:advance to continue"
- If DRAINED → "Ledger drained — nothing to do."

**Just report. Do not run the loop.**
