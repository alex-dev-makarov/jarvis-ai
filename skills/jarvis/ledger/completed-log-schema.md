# Completed Log Schema

## File: `./docs/completed-log.md`

Detailed, append-only report for every PR that reaches `go-ahead`. Create
if it does not exist (including the `docs/` directory). Never overwrite —
always append.

## Why this is separate from docs/tasks.md

`docs/tasks.md` is the ledger you scan constantly — every O2/O3/O4 cycle
reads it to decide what's next. A full prose report per PR (what shipped,
verification traces, notes, cost) bloats that file fast: after 20 PRs,
scanning tasks.md for "what's still open" means scrolling past 20 dense
paragraphs you don't need for that question.

So the split is:
- **`docs/tasks.md`** — one line per completed PR, just enough to know it
  shipped and where to look for detail. This is what the loop reads.
- **`docs/completed-log.md`** — the full report per PR: what shipped,
  verification, notes, metrics, cost, approval. This is what a HUMAN reads
  when they want to understand a specific PR later — onboarding, an
  incident retro, or just "why did we do it this way."

## What goes in docs/tasks.md instead (replaces the old inline Completed block)

Per tasks-schema.md's table format — a row, not a bullet:

```
| PR | Scope | Report |
|---|---|---|
| PR-01 | Add lazy social-login init module | completed-log.md#pr-01 |
```

Three cells. Scope, pointer, nothing else.

## Entry schema for docs/completed-log.md

```markdown
## PR-01 — <scope, same wording as the tasks.md line>
**Date:** YYYY-MM-DD
**Shipped:** <prose — what was built, key design decisions>
**Verification:** <commands run + exact output, or what the reviewer
  specifically traced/confirmed>
**Notes:** <surprises, discoveries, deferred nits, constraints future
  work must respect — anything worth remembering that isn't "it works">
**Metrics:** review rounds N; defects major:N, minor:N, nit:N
**Cost:** <if available from Claude Code's own usage reporting for this
  PR's subagent calls — see "Cost tracking" below. Omit the field entirely
  if you don't have a real number; never estimate or guess a dollar figure>
**Approved:** jarvis-reviewer go-ahead (round N) — or, if the user
  intervened (resolved a BLOCKED bugfixer question, confirmed a DECLINED
  defect, overrode an ESCALATE), name that instead:
  `user (resolved BLOCKED on D-04, then jarvis-reviewer go-ahead)`
```

Anchor each section with a heading Claude Code/GitHub-flavored markdown can
link to (`## PR-01 — ...` → `#pr-01`), so `docs/tasks.md`'s pointer actually
resolves to the right spot when opened.

## Cost tracking — be honest about what's knowable

Claude Code reports total session cost/tokens, not a clean per-PR
breakdown — there is no reliable API call inside the loop to ask "exactly
how many tokens did the executor+reviewer+bugfixer calls for THIS PR
cost." Two honest options, pick whichever `jarvis.context.md` doesn't
override:

**Option A — omit the field.** Simplest, zero risk of a fabricated number.
Most projects should default to this unless cost tracking is specifically
requested.

**Option B — rough estimate, clearly labeled as such.** If you have
visibility into subagent tool-call counts for this PR (e.g. from narrating
`✓ jarvis-executor done — N tool uses` per the Live narration discipline in
inner-loop.md) and know each tier's approximate per-call cost, you can
write something like:
```
**Cost:** ~$0.08 (estimated from ~35 executor + 20 reviewer tool calls;
  not a metered figure — Claude Code doesn't expose per-PR cost directly)
```
Always label it "estimated," always explain the basis. A confident-looking
number with no disclaimer is worse than no number — someone will treat it
as accurate and make a decision on it.

**Never do:** invent a precise-looking cost with no stated basis. If asked
"how much did this cost" and you don't have real usage data for that PR,
say so plainly rather than producing a plausible number.

## Migration note

If `docs/tasks.md` already has old-style inline Completed blocks from
before this schema existed, leave them as-is — don't retroactively split
them into completed-log.md. Apply the new split going forward only.