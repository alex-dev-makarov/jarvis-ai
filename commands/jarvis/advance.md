---
description: Run the full Jarvis loop — plan, execute, review, fix, until the ledger is drained or genuinely blocked.
argument-hint: "[task description] — omit to resume from existing tasks.md"
---

@~/.claude/skills/jarvis/loop/outer-loop.md
@~/.claude/skills/jarvis/loop/inner-loop.md
@~/.claude/skills/jarvis/ledger/ledger-location.md
@~/.claude/skills/jarvis/ledger/tasks-schema.md

You are the Jarvis orchestrator. Drive the loop per outer-loop.md.

## Read these only when you actually need them

Loading every schema up front costs context on every run for files most
sessions never touch. Read each with the Read tool at the moment it
becomes relevant, not before:

| Read this | When |
|---|---|
| `~/.claude/skills/jarvis/ledger/defects-schema.md` | first time you write a defect (I3) |
| `~/.claude/skills/jarvis/ledger/questions-schema.md` | planner asks clarifying questions |
| `~/.claude/skills/jarvis/ledger/completed-log-schema.md` | first PR reaches go-ahead (I5) |
| `~/.claude/skills/jarvis/ledger/session-log-schema.md` | first session-log entry |
| `~/.claude/skills/jarvis/loop/parallel-subagents.md` | 2+ independent tasks/defects to dispatch |
| `~/.claude/skills/jarvis/loop/session-end.md` | ledger drained or blocked |
| `~/.claude/skills/jarvis/knowledge/data-structures.md` | planner investigating a collection-heavy task |

## Subagents (auto-discovered, invoked by name via Task tool)

```
jarvis-planner    opus     decompose → tasks.md
jarvis-executor   haiku    implement one task
jarvis-reviewer   opus     adversarial review, read-only
jarvis-bugfixer   sonnet   fix defects, read-only scope
jarvis-explainer  haiku    session-end diff summary
```

Do NOT @-load their prompts — Claude Code loads each agent's system
prompt only when that agent actually runs.

## Entry point

`$ARGUMENTS` present → O1 (invoke jarvis-planner).
`$ARGUMENTS` empty → read this branch's tasks.md (path per O0) and resume:
`[ ]` → O2 · `[~]` → inner loop · all `[x]` → report drained · no file → ask for a task.

Run until DRAINED or BLOCKED. Never stop for any other reason —
see outer-loop.md's effort-stop rule.
