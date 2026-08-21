---
description: Run a performance audit (unused JS/CSS, lazy-load candidates) on a given scope. Read-only — writes findings to a new per-session file under docs/perf-findings/, never edits code.
argument-hint: <file/route/component path> — required; defaults to nothing if omitted, this command does NOT audit the whole project unless you explicitly say so
---

## Steps

### 1. Confirm scope — do not default to "whole project"

If `$ARGUMENTS` is empty → ask the user which file/route/component to
audit. Do NOT proceed with an unscoped project-wide audit unless the user
explicitly says "the whole project" or equivalent — jarvis-perf.md's own
scope discipline expects a bounded target, and an unscoped audit burns far
more of its ~8-12 tool-call budget on triage than on actual findings, and
tends to produce an oversized single-session file.

### 2. Check for research/perf-patterns.md

```bash
cat research/perf-patterns.md 2>/dev/null || echo "NOT_FOUND"
```

If not found — note this to the user (findings will all come back as "no
comparable pattern on file" without it) and suggest running `./install.sh`
from the jarvis-final repo to copy it in, but proceed with the audit
anyway — a missing patterns file doesn't block Tier 1 static analysis.

### 3. Invoke jarvis-perf subagent

Invoke the `jarvis-perf` subagent (Sonnet, `~/.claude/agents/jarvis-perf.md`)
with:
- the confirmed scope from step 1
- whether Tier 2/3 detection was explicitly requested (default: Tier 1 only)
- `research/perf-patterns.md`'s content, if found in step 2

It is read-only by design (no Write/Edit tools) — it can only write to a
NEW file under `docs/perf-findings/` (its own naming convention:
`YYYYMMDD-HHMM-<slug>.md`, one file per session, never appended to an
earlier one) via its own Write access to that directory; it cannot touch
source code.

### 4. Report findings

Print each finding from the session's new file in a compact table —
`what` (truncated to one line), `verdict`, whether desktop/mobile diverge,
`patternMatch`. Full JSON stays in the file for reference. Name the exact
file path in your report so the user can find it again.

### 5. End with a plain confirmation prompt — do NOT auto-fix

```
─────────────────────────────────────────────────
Found N performance findings — written to docs/perf-findings/<filename>.md.

Want me to act on any of these? (removal/lazy-loading goes through
jarvis-executor via the normal advance flow — nothing gets touched
automatically.)
─────────────────────────────────────────────────
```

Interpret the reply naturally — same discipline as `/jarvis:security`'s
confirmation gate. If the user says yes to specific findings, hand those
off to `jarvis-executor` per the normal advance-gate (user confirms →
executor executes → logs to `docs/completed-log.md`, quoting the
finding's `howFound` field verbatim). When a finding from this session's
file gets fixed, its entry can be marked resolved in place in that same
file (see jarvis-perf.md's "Where findings go") — do not move it elsewhere.

## Does NOT

- Does not run Tier 2/3 detection unless explicitly requested
- Does not run any analyzer/build/browser-automation tool on its own
- Does not edit or delete code — findings only, ever
- Does not auto-continue into a fix cycle without the user's go-ahead
- Does not append to or edit a previous session's findings file