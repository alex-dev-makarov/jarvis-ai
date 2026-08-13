---
description: Plan a task — decompose into docs/tasks.md without executing.
argument-hint: <task description>
---

@~/.claude/skills/jarvis/ledger/tasks-schema.md
@~/.claude/skills/jarvis/ledger/questions-schema.md

Invoke the `jarvis-planner` subagent (Opus, defined in `~/.claude/agents/jarvis-planner.md`) with this task:
> $ARGUMENTS

It may ask clarifying questions first (multiple-choice with a free-text
fallback) — wait for the answer before it proceeds. It then writes:
1. Detailed plan to `./docs/drafts/YYYYMMDD-HHMM-<name>.md`
2. Populates `docs/tasks.md` with milestones + PR breakdown

After it returns:
- Print the plan summary (milestones, PR list)
- Print: "Run /jarvis:advance to start executing"
- **STOP** — do not execute anything
