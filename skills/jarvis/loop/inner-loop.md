# Inner Loop

Drives one PR/task from planned to clean-reviewed and committed.

## Live narration (do this in your own chat response, not just the log)

The user is watching this run in real time. **Claude Code's progress
indicator (spinner + elapsed time) is not enough on its own — it shows
nothing about WHICH agent is running or WHY.** You must produce actual
text output between subagent calls for the user to see anything beyond a
generic spinner.

**This means: do not chain multiple Task tool calls back-to-back in the
same turn without text between them.** If I1→I2→I3→I4 all fire as tool
calls with no narration text separating them, the user sees one long
spinner and nothing else until the very end — that is the failure mode
this section exists to prevent.

Before invoking any subagent, write one line of text (not a tool call)
saying what you're about to do and why. Let that text actually render, THEN
invoke the subagent. After it returns, write one line saying what happened
and what's next — again, real text output, before moving to the next tool
call.

This is IN ADDITION to the session-log entry below — the log is the durable
record, this is the live narration the user reads as it happens.

Format — short, no preamble, no markdown headers mid-flow:

```
→ Invoking jarvis-executor (Haiku) on PR-02: add usePagination hook

  [subagent runs]

✓ jarvis-executor done — created usePagination.ts, modified ProductList.tsx
→ Invoking jarvis-reviewer (Opus) to check PR-02 diff
```

If a subagent's own step involves multiple internal actions (e.g. planner
asking questions, reviewer finding issues) — summarize the outcome in 1-2
lines, don't dump the subagent's full raw output. The user wants to follow
the STORY (who's working, on what, what happened), not read every token
each subagent produced.

**Never go silent for more than one subagent call.** If dispatching a
parallel group (parallel-subagents.md), narrate the whole group as one
line ("→ Dispatching 3 parallel executors: PR-04, PR-05, PR-06") then one
line per result as they come back — don't wait until all three finish to
say anything.

**Concretely, what NOT to do (this is the bug this section fixes):**
```
[Task: jarvis-executor]
[Task: jarvis-reviewer]
[Task: jarvis-bugfixer]
[Task: jarvis-reviewer]
"PR-02 is done."
```
Four tool calls, zero narration, user sees only a spinner for the whole
duration, then one line at the end. This is wrong even if it's faster to
write — the user loses the ability to follow along or intervene.

**What TO do instead:**
```
→ Invoking jarvis-executor (Haiku) on PR-02: add usePagination hook
[Task: jarvis-executor]
✓ jarvis-executor done — created usePagination.ts, modified ProductList.tsx
→ Invoking jarvis-reviewer (Opus) to check PR-02 diff
[Task: jarvis-reviewer]
✓ jarvis-reviewer done — verdict: revise (2 findings)
→ Invoking jarvis-bugfixer (Sonnet) on 2 defects
[Task: jarvis-bugfixer]
✓ jarvis-bugfixer done — both fixed
→ Re-checking with jarvis-reviewer (Opus)
[Task: jarvis-reviewer]
✓ jarvis-reviewer done — verdict: go-ahead
→ PR-02 committed
```
Same four tool calls, but each one is bracketed by real text the user
actually sees rendering as it happens.

## Session logging (do this after EVERY subagent returns)

Maintain `.jarvis/session-log.md` per session-log-schema.md. After each
subagent (executor, reviewer, bugfixer, visual-planner) returns, append one
entry recording: time, agent, model, files touched (with created/modified/
read-only tags), what it did, and what comes next.

```bash
mkdir -p .jarvis
# append entry after each subagent — see session-log-schema.md for format
```

This is orchestrator work — you write the entry based on what the subagent
reported back. It costs almost nothing (a text append) and gives a scannable
timeline. If `.jarvis/session-log.md` doesn't exist yet, create it with a
session header first. Never block the loop on logging — if unsure of exact
tokens, omit that field rather than guessing.

## Project context (load once per session)

Before I1, check if `jarvis.context.md` exists in the project root:

```bash
cat jarvis.context.md 2>/dev/null || echo "NO_CONTEXT"
```

**If the file contains `@path/to/skill.md` lines** — these are references to
local skill files, not something `cat` will expand on its own. Resolve them
yourself before extracting sections: for each line matching `@([\w./\-]+\.md)`,
read that file's content and substitute it in place of the `@reference` line.
A simple way:

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('jarvis.context.md', 'utf8');
const resolved = content.replace(/^@(.+\.md)\$/gm, (_, p) => {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return \`[skill not found: \${p}]\`; };
});
console.log(resolved);
"
```

If a referenced path doesn't exist, note it as `[skill not found: <path>]`
in your working memory rather than failing the whole context load — the
other sections of jarvis.context.md are still valid.

If it exists — extract and keep these two sections in memory for this session
(with any `@references` inside them already resolved to their full content):
- `## Review Rules` → pass to jarvis-reviewer in every I2 brief
- `## Executor Rules` → pass to jarvis-executor in every I1 brief

If it does not exist — continue without it. Never fail on missing file.

---

## I0 — Image detection (screenshot-to-code routing)

**Run this BEFORE I1 on every task.** Takes ~0 tokens if no image present.

Check if the current task contains an image input (screenshot, mockup, design):

```
Image input is present when ANY of:
  - The task message contains an attached image
  - docs/tasks.md entry has a field: image: <path> or screenshot: <path>
  - The user's original request mentioned "screenshot", "mockup", "design file",
    "figma", "from this image", "implement this UI"
```

**If NO image detected → skip to I1 immediately. Fable is never called.**

**If image IS detected → run visual pipeline:**

### I0-A: Invoke jarvis-visual-planner (Fable)

Brief must contain:
- The image itself
- Task description (what UI to implement)
- `## Executor Rules` from `jarvis.context.md` (existing component inventory,
  CSS Variable tokens, typography scale) — visual-planner needs real primitives
  to decide what to reuse vs create new

Fable timeout guard: if visual-planner does not return within 90 seconds,
cancel and fall back to text-only planning via jarvis-planner (Opus).
Log: `visual-planner timeout — falling back to jarvis-planner`.

### I0-B: Validate plan output

Visual-planner returns a JSON plan. Validate it has:
- `component_tree` (array, non-empty)
- `layout` (object)

If malformed → log warning, proceed to I1 with raw plan text as context.
Do NOT retry visual-planner — Fable is expensive. One attempt only.

### I0-C: Attach plan to executor brief

Proceed to I1 with the validated plan injected into the executor brief.
The plan replaces the need for the executor to "figure out" the structure —
it just implements what visual-planner specified.

**Reviewer (I2) for visual tasks:** pass BOTH the original screenshot AND
the final code diff. Reviewer (Opus) can compare implementation fidelity
against the design. Fable is NOT called again — Opus handles this check.

---



## I1 — Execute

**Before building the brief, check for per-directory `AGENTS.md` files.**
Separate from `jarvis.context.md` (project-wide rules): `AGENTS.md` files
live inside specific subdirectories and document module-specific danger
zones — a complex hook with its own state machine, a wrapper around a
finicky external library, a validation function whose tests must stay in
sync with it. This is the emerging convention covered in Addy Osmani's
AEO writeup — same spirit as `README.md` for humans, but for agents, and
scoped to the directory it lives in rather than the whole repo.

For each file the task will touch, walk UP from that file's directory to
the project root, checking for `AGENTS.md` at each level:

```bash
# e.g. task touches src/components/Feature/SubModule/Widget/index.tsx
# check in order:
#   src/components/Feature/SubModule/Widget/AGENTS.md
#   src/components/Feature/SubModule/AGENTS.md
#   src/components/Feature/AGENTS.md
#   src/components/AGENTS.md
#   src/AGENTS.md
#   AGENTS.md (project root, if you're not already loading it as
#              jarvis.context.md's content)
```

Include the CLOSEST one found (most specific directory wins if multiple
exist up the chain — a closer AGENTS.md is more specific to what the
executor is about to touch, so it takes precedence over a more general one
further up). If none exist, proceed without it — this is optional context,
not a required file like `jarvis.context.md`.

Invoke the `jarvis-executor` subagent (Haiku) with a self-contained brief:
- the task and its success criterion
- exact file paths to touch
- relevant TypeScript interfaces only (not whole codebase)
- `## Executor Rules` from `jarvis.context.md` if present (stack-specific
  constraints — max files to read, forbidden imports, test conventions)
- **The closest `AGENTS.md` content, if found** — module-specific warnings
  take priority over general Executor Rules when they conflict (e.g.
  project-wide rule says "co-locate tests normally," but this module's
  AGENTS.md says "tests here must mirror the parent hook's test file
  exactly" — the more specific instruction wins)
- **If the PR's plan (from PLANNER) names a specific data structure**
  (e.g. "circular buffer for the last N events," "Trie for prefix search")
  — include that specific instruction in the brief, verbatim from the
  plan. Do NOT include the full `data-structures.md` decision guide here —
  PLANNER already made the choice during Step 1/2 (see jarvis-planner.md);
  EXECUTOR just needs to know WHICH structure to implement, not the full
  comparison table that led there. If the plan is silent on structure for
  a task that clearly needs one — that's a planning gap, not something for
  EXECUTOR to resolve; surface it as a question rather than picking one
  (see jarvis-executor.md's Does NOT on this).
- **If visual pipeline ran (I0):** include the component plan JSON from
  visual-planner. Executor implements the plan exactly — does not re-analyse
  the screenshot (no vision needed at this stage, Haiku handles it cheaply)

If broken tests exist alongside new work — invoke `jarvis-bugfixer` (Sonnet)
in parallel. For independent sub-tasks within the same PR, apply
`parallel-subagents.md` — build the dependency graph first (Step 1), then
dispatch independent groups together (Step 3), collect and review once
(Step 4). Do not parallelize sub-tasks that touch the same file.

---

## I2 — Adversarial review

**First, classify risk tier — this determines review depth, not whether
review happens at all. Every PR still gets reviewed; low-risk PRs just get
a narrower check instead of the full checklist.**

```
LOW risk  — the diff touches ONLY: comments, docstrings, markdown/docs
            files, variable/function renames with no logic change,
            whitespace/formatting, or adding a test with no production
            code change
HIGH risk — anything touching: auth/session/token handling, payment
            flows, data validation boundaries, database queries,
            permission checks, or ANY file jarvis.context.md's Review
            Rules calls out as sensitive
STANDARD  — everything else (the default)
```

Classify by reading the diff's file list and change type — do not guess
from the task description alone, the actual diff decides this.

**LOW risk** → still invoke `jarvis-reviewer`, but the brief says
"LOW-RISK REVIEW: check only for typos/broken links in docs, or
unintended logic changes hiding in what should be a pure rename/comment
diff — skip the full architecture/tests/scope checklist." This is
narrower work per call, not skipped work — see the AI Engineer World's
Fair point that humans (and by extension, the review budget we spend)
belong in the sampling loop, not gone entirely.

**HIGH risk** → full checklist, no shortcuts, and do NOT allow this PR
into a batch review (see outer-loop.md O2.6) even if file-independent from
other PRs in the milestone — sensitive changes get their own dedicated
review pass regardless of what else is happening.

**STANDARD** → the normal full checklist below, exactly as already
specified.

Invoke the `jarvis-reviewer` subagent (Opus) with:
- `git diff HEAD` — diff only, never full files
- original task description (one line — what was asked)
- the risk tier classification (LOW/STANDARD/HIGH) and what that means
  for review depth, per above
- `## Review Rules` from `jarvis.context.md` if present (project-specific
  rules: RTK Query tags, CSS Variables, component boundaries, etc.)
- the same closest `AGENTS.md` content passed to executor in I1, if one was
  found — reviewer checks the diff against module-specific rules too, not
  just project-wide ones (e.g. did the executor actually follow this
  module's "tests must mirror the parent hook" instruction?)

This subagent has no Write/Edit tools by design — it can only critique,
never fix.

**Narrate the verdict immediately when it returns** — this is the moment
the user most wants visibility on:
```
✓ jarvis-reviewer done — verdict: revise (2 findings: 1 major, 1 minor)
```
or
```
✓ jarvis-reviewer done — verdict: go-ahead, no blockers
```

**Parse verdict from FIRST line of reviewer output:**
- `verdict: go-ahead` → go to I5
- `verdict: revise` → go to I3
- `verdict: revise — ESCALATE` → go to I6 immediately
- anything else → ABSTENTION — log it, repeat I2 (counts as a round)

**Track round number.** Increment on every I2 call for this PR.

---

## I3 — Update docs/defects.md

For every finding in reviewer output:
- Append full structured entry to docs/defects.md (defects-schema.md format)
- Assign IDs sequentially: `PR-NN-D01`, `PR-NN-D02`, ...
- IDs never change once assigned — even after fix
- Flip current task to `[~]` in docs/tasks.md (still in progress)

Do this yourself — it is orchestration work, not subagent work.

---

## I4 — Fix

For each open defect: flip status to `[~] under fix`.
Invoke `jarvis-bugfixer` (Sonnet) per defect. For independent defects, apply
`parallel-subagents.md` Steps 1-4 — dependency graph, isolated dispatch,
merge/collect, single review pass on the combined result.

Each subagent brief must contain:
- full defect entry (headline + Location + Description + Suggested fix)
- exact file paths
- what "fixed" looks like (acceptance criterion)

When fix returns:
- Fill `Fix:` field with what was done (file:line of change)
- Flip status to `[x] resolved`

**If bugfixer returns `BLOCKED on [defect-id]: ...` instead of a fix** —
do NOT mark it resolved, do NOT retry it yourself, do NOT invoke another
bugfixer to "try again" on the same defect. Surface it to the user
immediately, in your own narration (not buried in a log):

```
⚠ jarvis-bugfixer couldn't fix [defect-id] — needs your input:
  <the "Need:" line from bugfixer's BLOCKED report>
```

Leave that defect `[~] under fix` (not resolved, not back to `open` — it's
genuinely stuck pending human input) and continue with any OTHER
independent defects in the same batch that didn't hit this. Don't let one
blocked defect stall unrelated fixes.

**If bugfixer returns `DECLINED [defect-id]: ...` instead of a fix** —
this is bugfixer exercising discernment (it understood the issue and
judged it not worth fixing), not a failure. Do NOT mark it resolved, do
NOT silently accept the decline and close it either — a subagent's
judgment call still needs the human's sign-off per the outer-loop
ownership model. Surface it plainly:

```
◻ jarvis-bugfixer declined to fix [defect-id]:
  <the "Reasoning:" line from bugfixer's DECLINED report>
  Reply "fix anyway" to override, or "wontfix" to accept and close it.
```

Flip the defect to `wontfix` ONLY after the user confirms — until then
leave it `open` with the DECLINED reasoning appended to its `Description`
field so the context isn't lost if this comes up again later.

→ For defects that WERE fixed, go back to I2 for another review round.
→ For any BLOCKED defect, wait for the user's answer before re-dispatching it.
→ For any DECLINED defect, wait for the user's confirm/override before
  changing its status.

**Cross-round regressions get a NEW defect ID — never re-open closed defects.**

---

## I5 — Clean review → close out

When verdict is `go-ahead`:
- Flip task from `[~]` to `[x]` in `docs/tasks.md`
- Replace the task line with a one-liner pointing to the detailed report
  (per completed-log-schema.md) — do NOT write the full prose report
  inline in `docs/tasks.md`, it belongs in `docs/completed-log.md`:
  ```
  - [x] **PR-NN** — <scope>. See completed-log.md#pr-nn
  ```
- Append the full entry to `docs/completed-log.md` (completed-log-schema.md
  format): what shipped, verification, notes, metrics, cost (if known —
  see completed-log-schema.md's honesty rules on cost, never fabricate a
  number), and:
  - `Approved: jarvis-reviewer go-ahead (round N)` — or, if the user
    intervened at any point (answered a BLOCKED bugfixer question,
    confirmed a DECLINED defect, overrode an ESCALATE), name that instead:
    `Approved: user (resolved BLOCKED on D-04, then jarvis-reviewer go-ahead)`
    This is the accountability trail — it should be possible to look at
    any shipped PR later and answer "who/what actually signed off on this,
    and under what circumstances" without reconstructing it from the full
    session log.
- Commit: code changes + ledger updates — ONE commit per PR
  - Message: `PR-NN: <scope>`
- → Return to outer loop O4. Do NOT return to user here.

---

## I6 — Blocker

Fires when:
- Reviewer returns `verdict: revise — ESCALATE` (round 4+ with major findings)
- Question cannot be resolved from code or brief
- Ambiguous requirement needs user judgement

Actions:
- Mark task `[!]` in docs/tasks.md
- Record exact blocker: what is the unresolved question
- Escalate to session-end.md

---

## Round tracking

```
PR-NN review rounds: 0
After each I2 call: increment
Round 4 with verdict: revise + major findings → I6 (ESCALATE)
Round 4 with verdict: revise + only minor/nit → continue one more round
Round 5 any revise → I6 (ESCALATE) regardless of severity
```
