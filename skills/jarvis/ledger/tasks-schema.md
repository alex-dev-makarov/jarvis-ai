# Tasks Ledger Schema

## File: `./docs/tasks.md`

The authoritative ledger of all planned and completed work.
Create if it does not exist (including the `docs/` directory). Never
overwrite — always append.

## Status markers

```
[ ] planned   ·   [~] in progress   ·   [x] done   ·   [!] blocked
```

## Required sections (in order)

### 1. Milestones (high-level)
One line per milestone. Terse — detail lives in PR breakdown below.

### 2. Current milestone — PR breakdown
One line per PR/task, 2-4 lines max if extra context is genuinely needed
(per jarvis-planner.md's own conciseness rule). Detail lives in
`./docs/drafts/YYYYMMDD-HHMM-<name>.md` — NOT here.

**Hard rule: no paragraph-length "why" explanations under a PR line.**
If a PR needs a rationale longer than 1-2 sentences, that rationale
belongs in the plan doc (`docs/drafts/...`), not inline in tasks.md. A
milestone section in this file should be scannable in a few seconds —
if scrolling past one milestone takes more than a screen, it's already
too long for this file.

Optionally note `dependsOn: PR-NN` inline when a PR cannot start until
another finishes (e.g. it imports a hook the earlier PR creates). This is
read by `parallel-subagents.md` when deciding what can run concurrently —
without it, independence is inferred from file overlap alone, which misses
import-order dependencies between files that don't share a path.

```
- [ ] **PR-04** — Wire ProductCard to usePagination hook (dependsOn: PR-03)
```

### 3. Cross-cutting architectural notes (locked)

**One line per decision, max ~30 words.** State WHAT was decided and
which PR it lands in — not the full reasoning chain that led there.

```
- [x] Use httpOnly cookies for auth tokens, not localStorage — lands in PR-02
- [ ] Retry strategy for failed uploads — undecided, blocks PR-05
```

**This is explicitly NOT the place for:**
- Multi-paragraph "рішення" write-ups explaining code mechanisms, quoted
  line numbers, or the full chain of investigation that led to a decision
  — that belongs in the plan doc (`docs/drafts/YYYYMMDD-HHMM-<name>.md`)
  or, if the PR already shipped, in `docs/completed-log.md`'s `Shipped`/
  `Notes` fields (see completed-log-schema.md)
- "Explicitly out of scope" sections listing rejected alternatives with
  their rationale — one line per rejected item max ("Rejected: X (reason
  in one clause)"), full reasoning goes in the plan doc
- Risk analysis, verification protocols, or scope boundaries longer than
  a few bullet lines — these belong in the plan doc too

**Never silently delete — flip `[ ]` to `[x]` when resolved.**

If you notice a milestone's architectural notes growing past ~10-15
lines, that is the signal to move the detail out to the plan doc and
leave only the one-line decisions here — do not let it keep growing
in place.

### 4. Completed
One SHORT line per finished PR — see completed-log-schema.md for the full
detailed report, which lives in `./docs/completed-log.md`, not here:
```
- [x] **PR-01** — <scope>. See completed-log.md#pr-01
```

Why the split: a full prose report per PR (verification traces, notes,
metrics, cost) bloats docs/tasks.md fast — after 20 PRs, scanning for
"what's still open" means scrolling past 20 dense paragraphs. tasks.md
stays a scannable ledger; completed-log.md is where the detail lives for
whoever wants to read it later.

## Rules

- Flip `[ ]` → `[~]` when work starts
- Flip `[~]` → `[x]` AND add the one-line pointer + append the full report
  to `docs/completed-log.md` when a PR merges (see completed-log-schema.md)
- Never delete lines — append only
- When milestone closes: migrate the `[x]` one-liners to
  `./docs/archive/tasks-<milestone-id>.md`, leave a stub; completed-log.md
  entries stay put (they're already archival by nature)

## Skeleton

```markdown
# <Project> — Task Ledger

Status: `[ ]` planned · `[~]` in progress · `[x]` done · `[!]` blocked

## Milestones
- [~] **M1** — <one-line goal>
- [ ] **M2** — <one-line goal>

## Milestone 1 — PR breakdown
Detail in `./docs/drafts/YYYYMMDD-HHMM-m1-plan.md`
- [x] **PR-01** — <scope>
- [~] **PR-02** — <scope>
- [ ] **PR-03** — <scope>

## Cross-cutting architectural notes (locked)
- [x] <decision> — <rationale, lands in PR-N>
- [ ] <open question> — <who/when decides>

## Completed
- [x] **PR-01** — <scope>. See completed-log.md#pr-01
```