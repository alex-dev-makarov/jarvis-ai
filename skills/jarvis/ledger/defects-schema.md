# Defects Ledger Schema

## File: `./docs/defects.md`

Audit trail of every defect found by reviewer or discovered during work.
Create if it does not exist (including the `docs/` directory). Never
delete entries — only update status.

## Status lifecycle

```
open → wip → root-caused → resolved
              ↓
          inconclusive
              ↓
          wontfix     (deliberate decision by USER, rationale required)
              
open → wip → declined  (deliberate decision by BUGFIXER's discernment —
                         "understood the tradeoff, not worth fixing";
                         see jarvis-bugfixer.md "When the defect isn't
                         actually worth fixing" — stays open pending
                         user confirm/override, does NOT auto-close)
```

**`wontfix` vs `declined` — different origin, same spirit:** `wontfix` is
a USER decision (they read the defect, decided not to fix it, gave a
reason). `declined` is a BUGFIXER's own discernment call surfaced for the
user to confirm or override — it is not yet a closed decision, just a
recommendation with reasoning attached. A `declined` defect only becomes
`wontfix` once the user actually agrees; if they disagree, it goes back to
`open` for a normal fix attempt.

## Structure

One top-level section per PR (`## PR-01`, `## PR-02`).
Defects numbered `PR-NN-DMM` within each PR.
IDs never change once assigned — even after fix.

## Entry schema

```markdown
### [PR-NN-D01] <headline — states the problem, not the fix>
**Status:** open
**Severity:** major | minor | nit
**Location:** src/path/to/file.ts:42-51
**Description:** <what is wrong, what breaks, under what conditions>
**Root cause:** <fill when root-caused or resolved>
**Suggested fix:** <specific: file, function, exact change>
**Fix:** <fill when resolved: what was done, file:line>
**Reproduce first:** <test name or command that FAILS before fix>
**RequiresConfirmation:** <optional — "yes" if the loop must NOT auto-fix
  this without an explicit user go-ahead; omit for routine defects found
  during a normal PR review round>
**dependsOn:** <optional — another defect ID that must resolve first, e.g.
  a defect in a shared util another defect's fix imports. Read by
  parallel-subagents.md when building the dependency graph for O2.5/I4
  batch fixes — without it, independence is inferred from file overlap
  alone, which misses cases where two defects touch different files but
  one's fix logically requires the other's fix to land first>
**Declined reasoning:** <fill only when Status is declined — bugfixer's
  cost/risk tradeoff explanation, verbatim from its DECLINED report>
```

## RequiresConfirmation gate

Set by `/jarvis:security` on every finding it writes (security findings can
involve real secrets, real auth flows, real data exposure — these deserve a
human look before anything touches them). Routine defects from a normal
`jarvis-reviewer` round during inner-loop I3 do NOT set this field — those
fix automatically per the standard I3→I4 cycle, same as always.

While a defect carries `RequiresConfirmation: yes`, the outer loop's O2.5
step treats it as off-limits for auto-fix (it still counts toward
`P-review` being TRUE, but the loop will not dispatch `jarvis-bugfixer` on
it). The field is removed the moment the user explicitly approves that
specific defect (or "fix all") — see outer-loop.md O2.5 for the exact
confirmation-reply handling.

## Reproduce-first rule

Every major defect fix MUST start by writing a failing test or command
that proves the bug exists. Fix is complete only when that test passes.

## Severity levels

- `major` — blocks merge, causes incorrect behaviour
- `minor` — should fix, can defer with written rationale
- `nit` — cosmetic / nice-to-have, never blocks

## Rules

- Headlines describe the problem, never the fix
- Never delete — update status and fill `Fix:` when resolved
- `wontfix` requires a rationale sentence — never left blank
- Cross-round regressions get a NEW defect ID — never re-open closed ones
- When milestone closes: migrate resolved groups to
  `./docs/archive/defects-<milestone-id>.md`, leave one-line stub
