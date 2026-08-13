---
description: Direct fix — invokes jarvis-bugfixer ONLY, skipping planner/executor. Use when you already know what's broken and just want it fixed, without paying for a full plan→execute→review cycle.
argument-hint: "<description of the bug/error/failing test> — be specific: file, error message, or exact behavior"
---

You are dispatching a SINGLE `jarvis-bugfixer` call. This is a token-saving
shortcut — no `jarvis-planner` (Opus decomposition), no `jarvis-executor`
(new feature work). Use this when the user already knows exactly what's
broken and just wants it fixed, not planned.

## When this command is the wrong tool

If `$ARGUMENTS` describes something that isn't a fix — a new feature, an
unclear requirement, something needing investigation before you'd even
know what "fixed" means — say so and suggest `/jarvis:advance` or
`/jarvis:plan` instead. Don't force a vague request into a bugfixer brief
just because this command was invoked; a bugfixer given a vague brief
burns tool calls trying to figure out the actual bug (see jarvis-bugfixer.md
"When you don't understand the bug").

Good fit: "TypeScript error in src/hooks/usePagination.ts:12", "this test
is failing: `should return empty array when...`", "the modal doesn't close
on Escape key", "fix the defect PR-02-D03 from docs/defects.md".

Bad fit: "make the dashboard better", "add error handling" (too vague —
what's actually broken?), "refactor this file" (not a fix, that's scope
creep bugfixer explicitly avoids).

## Steps

### 1. Gather what bugfixer needs — do this yourself, cheaply

Do NOT invoke any subagent for this step — it's plain tool use:

- If `$ARGUMENTS` names a defect ID (e.g. "PR-02-D03") → read that exact
  entry from `docs/defects.md`
- If `$ARGUMENTS` describes a failing test → run it once to capture the
  actual error: `npx jest --testPathPattern=<guess from description> 2>&1 | tail -80`
- If `$ARGUMENTS` names a file + line or error message directly → that's
  enough, no extra investigation needed
- Check for a per-directory `AGENTS.md` per inner-loop.md's walk-up logic,
  if the target file is identifiable
- Check `jarvis.context.md` for `## Executor Rules` (bugfixer benefits from
  the same stack conventions — e.g. "tests use jest.unstable_mockModule")

Keep this to 1-3 tool calls. If you can't identify the failing file/test
in 3 calls, stop and ask the user for the specific file or command rather
than guessing further — see jarvis-bugfixer.md's own escalation discipline,
same principle applies to you here as orchestrator.

### 2. Invoke jarvis-bugfixer once

Brief:
- The bug description verbatim from `$ARGUMENTS`
- Whatever you gathered in step 1 (defect entry, error output, file path)
- `AGENTS.md`/`jarvis.context.md` conventions if found

### 3. Handle the result

- **Fixed** → report what changed (file:line), suggest `git diff` to review
- **`BLOCKED on ...`** → surface bugfixer's question directly to the user,
  do not guess an answer yourself
- **`DECLINED ...`** → surface bugfixer's reasoning, ask user to confirm or
  override — same handling as inner-loop.md I4's DECLINED case

### 4. Do NOT auto-continue into a review cycle

This command is intentionally narrow — one fix, reported back. If the user
wants adversarial review of the result, that's `/jarvis:review` as a
separate, deliberate next step. Chaining straight into `jarvis-reviewer`
here would silently turn a cheap one-agent command back into the full-cost
cycle this command exists to avoid.

## Does NOT

- Does not invoke jarvis-planner or jarvis-executor — if the request needs
  either, redirect to `/jarvis:advance` instead of forcing it through here
- Does not run a review pass automatically after the fix
- Does not touch `docs/tasks.md` — this is defect-fixing, not task-tracking
  (it DOES update `docs/defects.md` if the fix closes a tracked defect)
