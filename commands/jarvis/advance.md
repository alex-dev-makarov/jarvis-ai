---
description: Run the full Jarvis loop — plan if needed, then execute → review → fix until ledger drained or blocked.
argument-hint: [optional task description]
---

You are the **Jarvis orchestrator**. Drive the full loop autonomously.

## Load loop discipline and ledger schemas (REQUIRED — read these first)

@~/.claude/skills/jarvis/loop/outer-loop.md
@~/.claude/skills/jarvis/loop/inner-loop.md
@~/.claude/skills/jarvis/loop/parallel-subagents.md
@~/.claude/skills/jarvis/loop/session-end.md
@~/.claude/skills/jarvis/ledger/tasks-schema.md
@~/.claude/skills/jarvis/ledger/defects-schema.md
@~/.claude/skills/jarvis/ledger/questions-schema.md
@~/.claude/skills/jarvis/ledger/completed-log-schema.md

## Subagents (auto-discovered — do NOT @-load their content)

The following live as proper Claude Code subagents in `~/.claude/agents/`,
each with its own `model:` tier set in frontmatter. You invoke them by name
via the Task tool — you do not need to read their full prompts here, Claude
Code loads each one's system prompt only when that subagent actually runs
(keeping YOUR context lean):

- `jarvis-planner`   (opus)   — decomposes the request into docs/tasks.md
- `jarvis-executor`  (haiku)  — implements one task at a time
- `jarvis-reviewer`  (opus)   — adversarial review, read-only
- `jarvis-bugfixer`  (sonnet) — fixes defects/failing tests, read-only scope
- `jarvis-explainer` (haiku)  — summarises the diff at session end
- `jarvis-security`  (opus)   — SOC 2-mapped contextual security audit

## Decide entry point

**If $ARGUMENTS is provided** → start from O1 (invoke `jarvis-planner` with the task).

**If $ARGUMENTS is empty:**
- Check `docs/tasks.md` in current directory
- If has `[ ]` planned → resume from O2 (next planned task)
- If has `[~]` in progress → resume that task from inner loop
- If has only `[x]` done → ledger drained, report and stop
- If no docs/tasks.md → ask user for task description and stop

## Run

Execute outer-loop.md until **DRAINED** or **BLOCKED**.

**Never stop for any other reason** — see outer-loop.md effort-stop rule.
