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
One line per PR/task.
Detail lives in `./docs/drafts/YYYYMMDD-HHMM-<name>.md`.

Optionally note `dependsOn: PR-NN` inline when a PR cannot start until
another finishes (e.g. it imports a hook the earlier PR creates). This is
read by `parallel-subagents.md` when deciding what can run concurrently —
without it, independence is inferred from file overlap alone, which misses
import-order dependencies between files that don't share a path.

```
- [ ] **PR-04** — Wire ProductCard to usePagination hook (dependsOn: PR-03)
```

### 3. Cross-cutting architectural notes (locked)
Decisions that span multiple PRs.
Never silently delete — flip `[ ]` to `[x]` when resolved.

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
