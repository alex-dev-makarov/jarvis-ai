# Session End

Fires only from outer loop O5 (ledger drained) or inner loop I6 (blocker).

## Steps

### 1. Invoke jarvis-explainer

Input: final `git diff HEAD`.
This subagent (Haiku) runs in its own context — see jarvis-explainer.md
for output format.

### 2. Close out the session log

Append a SESSION END entry to `.jarvis/session-log.md` per
session-log-schema.md:

```markdown
---
### HH:MM · SESSION END
**State:** DRAINED | BLOCKED-ON-QUESTIONS | BLOCKED | MIXED
**Completed:** PR-01, PR-02, PR-03
**Open:** none | <list>
**Summary:** <one line>
```

This is the running timeline (scannable, per-action). It is SEPARATE from
the narrative log in step 3 below (which is the prose write-up).

### 3. Write narrative session log

File: `./docs/logs/YYYYMMDD-HHMM-log.md`
Write yourself from conversation context — not a subagent.

Log must contain:
- original user request (verbatim)
- milestones and PRs worked this session
- review rounds per PR: what was found, what was fixed
- deferred defects and why
- final ledger state (copy of docs/tasks.md milestone/breakdown sections)
- if blocked: exact question the user must resolve
- `Metrics: review rounds PR-01:N PR-02:N; defects major:N minor:N nit:N`

### 4. Return to user

One short message only:
- which PRs landed
- where the log lives
- if blocked: the exact question to resolve

No prose recap of loop iterations — the log has that.
