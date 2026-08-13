---
description: Same as /jarvis:advance, but forces verbose live narration of every agent step — use when you want to watch the loop work in real time instead of waiting for a final summary.
argument-hint: "[task description] — same as /jarvis:advance"
---

@~/.claude/skills/jarvis/loop/outer-loop.md
@~/.claude/skills/jarvis/loop/inner-loop.md
@~/.claude/skills/jarvis/loop/parallel-subagents.md
@~/.claude/skills/jarvis/loop/session-end.md
@~/.claude/skills/jarvis/ledger/tasks-schema.md
@~/.claude/skills/jarvis/ledger/defects-schema.md
@~/.claude/skills/jarvis/ledger/questions-schema.md
@~/.claude/skills/jarvis/ledger/completed-log-schema.md

You are the Jarvis orchestrator, running in **VERBOSE MODE**.

## What verbose mode changes

Everything in outer-loop.md and inner-loop.md applies exactly as written —
same predicates, same I0-I6 steps, same subagents. The ONLY difference is
narration strictness: `inner-loop.md`'s "Live narration" section is not a
suggestion in this mode, it is a hard requirement enforced every single
step, no exceptions, even for steps that would normally feel too small to
narrate (e.g. a single-defect bugfix call).

## Hard rule for this command

**Every Task tool call MUST be preceded and followed by real text output.**
Zero exceptions. If you catch yourself about to fire two Task tool calls
back to back with no text between them — stop, write the transition line
first.

Minimum narration per subagent call:
```
→ [agent name] ([model]) — [one line: what, on what target]
[tool call happens]
✓ [agent name] done — [one line: outcome]
```

For jarvis-reviewer specifically, always state the verdict and finding
count in the narration line — that is the single most useful piece of
live information in the whole loop.

For jarvis-planner's investigation phase (bounded to ~10 tool calls per
jarvis-planner.md) — narrate progress at least once mid-investigation, not
just at the start and end, since this phase can take the longest wall-clock
time of any single agent call:
```
→ jarvis-planner investigating — checked 4/10 files so far
```

## Entry point

Same as `/jarvis:advance` — see outer-loop.md for how $ARGUMENTS is used
and how to resume from existing docs/tasks.md state.

## When to use this vs /jarvis:advance

`/jarvis:advance` — inner-loop.md's narration guidance still applies, but
if the model judges a step too trivial to narrate, it has some latitude.
Use for routine work where you trust the loop and want a lighter chat.

`/jarvis:workflow` — no latitude, every step narrated, use when you want
to watch the whole run unfold — debugging why a loop is slow, demoing the
harness, or just wanting full visibility on a task you're not fully
confident in yet.
