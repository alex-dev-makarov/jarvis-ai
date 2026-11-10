---
description: Plan a task — decompose into this branch's tasks.md without executing.
argument-hint: <task description>
---

@~/.claude/skills/jarvis/ledger/ledger-location.md
@~/.claude/skills/jarvis/ledger/tasks-schema.md
@~/.claude/skills/jarvis/ledger/questions-schema.md

Invoke the `jarvis-planner` subagent (Opus, defined in `~/.claude/agents/jarvis-planner.md`) with this task:
> $ARGUMENTS

It may ask clarifying questions first (multiple-choice with a free-text
fallback) — wait for the answer before it proceeds. It then writes:
1. Detailed plan to `<ledger-root>/<branch-slug>/drafts/YYYYMMDD-HHMM-<name>.md`
2. Populates this branch's `tasks.md` with the milestone + PR tables
   (paths per ledger-location.md — resolve them before invoking)

After it returns:
- Print the plan summary (milestones, PR list)
- Print: "Run /jarvis:advance to start executing"
- **STOP** — do not execute anything
