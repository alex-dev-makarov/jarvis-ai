---
description: Run adversarial review on current git diff. Writes findings to docs/defects.md.
---

@~/.claude/skills/jarvis/ledger/defects-schema.md

## Steps

1. Run `git diff HEAD` — get the current changes
2. If diff is empty → report "no changes to review" and stop
3. Invoke the `jarvis-reviewer` subagent (Opus, `~/.claude/agents/jarvis-reviewer.md`) with the diff as input
4. Parse verdict from FIRST line of reviewer output:
   - `verdict: go-ahead` → print summary, STOP
   - `verdict: revise` → write findings to docs/defects.md per defects-schema.md format, print summary, STOP

**Do NOT execute fixes** — this command only reviews.
Run `/jarvis:advance` to execute the full fix cycle.
