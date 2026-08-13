# Parallel Subagents

General mechanism for running multiple subagents concurrently — used by
outer-loop.md (parallel executors/bugfixers) and inner-loop.md (parallel
sub-tasks within one PR). This file defines HOW to detect independence,
HOW to isolate concurrent work, and HOW to merge results. The loop files
tell you WHEN to apply it; this file tells you HOW.

## Step 1 — Build the dependency graph BEFORE dispatching anything

For a batch of candidate items (tasks, defects, or sub-tasks), determine
file-level independence. Two items are INDEPENDENT only if ALL of:

- They touch no file in common (check task/defect `Location` fields, or
  the file paths named in each task's scope)
- Neither imports the other's target file in a way that creates an
  ordering requirement (e.g. task A creates a hook that task B's file
  will import — B depends on A even if they don't "touch" the same file)
- Neither is a prerequisite noted in `dependsOn` (tasks-schema.md /
  defects-schema.md field) — respect explicit dependency declarations
  over your own file-overlap guess

If uncertain whether two items are independent — treat them as DEPENDENT
(run serially). A wrongly-serialized pair costs time; a wrongly-parallelized
pair costs a broken merge or a subagent overwriting another's work.

**Output of this step:** groups of item IDs, each group internally
independent, ordered by any cross-group dependencies.

```
Example:
  T-003 (src/hooks/usePagination.ts)      ─┐
  T-004 (src/components/Filters.tsx)       ├─ independent → parallel group
  T-005 (src/utils/formatDate.ts)         ─┘
  T-006 (src/hooks/usePagination.ts, edits same file as T-003) → depends on T-003
```

## Step 2 — Isolate concurrent work

**If items are in the SAME git working tree and touch DIFFERENT files:**
Parallel Task tool calls are safe as-is — no special isolation needed,
since each subagent's Write/Edit calls target non-overlapping paths.

**If items might touch overlapping directories, OR the task involves
running tests/builds that could interfere with each other:**
Use `git worktree` per parallel item:

```bash
git worktree add ../worktree-T003 -b jarvis/T-003
git worktree add ../worktree-T004 -b jarvis/T-004
```

Each subagent gets its own worktree path in its brief — it operates as if
it's the only one working. This matters most for jarvis-bugfixer (parallel
fixes shouldn't risk one fix's half-written state leaking into another's
test run) and for jarvis-executor when tasks are large enough to involve
running the dev server or test suite mid-task.

For small, clearly file-disjoint tasks (the common case — one component,
one hook) — skip worktrees, plain parallel Task calls are enough overhead
saved. Reserve worktrees for genuinely risky overlap.

## Step 3 — Dispatch in parallel

Invoke the Task tool multiple times in the SAME message/turn — this is
what makes them run concurrently rather than sequentially. Each call gets
its own brief per the normal I1/I4 brief rules (task/defect details +
Executor Rules or defect entry from jarvis.context.md) plus, if worktrees
are in use, the worktree path.

Do not wait for one subagent's result before dispatching the next
independent one — that defeats the purpose. Dispatch the whole independent
group together, then collect all results.

## Step 4 — Collect and reconcile

When all subagents in a group return:

1. Log each one's result to `.jarvis/session-log.md` per
   session-log-schema.md (one entry per subagent, same timestamp cluster
   is fine — they ran concurrently)
2. If worktrees were used: merge each branch back
   ```bash
   git merge jarvis/T-003 --no-ff
   git merge jarvis/T-004 --no-ff
   git worktree remove ../worktree-T003
   git worktree remove ../worktree-T004
   ```
   If a merge conflicts — this means Step 1's independence judgment was
   wrong. Resolve the conflict yourself (orchestrator), do not dispatch a
   third subagent to fix a merge conflict from a wrongly-parallelized pair.
3. Update docs/tasks.md / docs/defects.md status for each item as it normally would
   after I1/I4 — `[x] done` or defect `resolved`, per the loop the caller
   came from
4. Proceed to review (I2) for the whole merged diff together, not one
   review per item — reviewing the combined result once is cheaper than
   N separate review rounds, and catches cross-file issues a per-item
   review would miss (e.g. two independently-added hooks with a naming
   collision)

## What NOT to parallelize

- **jarvis-planner** — runs once, no parallel form; decomposition is
  inherently sequential (later PRs may depend on earlier architectural
  decisions)
- **jarvis-reviewer within the same PR** — one review per diff; running
  two reviewers on the same diff doesn't parallelize useful work, it just
  spends 2x tokens for one verdict (see jarvis.context.md Variant C /
  Chain pattern in architecture-concepts.md if you genuinely want two
  different reviewers checking different concerns — that's not this)
- **Anything the user hasn't confirmed** — defects marked
  `RequiresConfirmation: yes` never enter a parallel dispatch group,
  regardless of file independence (see outer-loop.md O2.5)
- **Items with unresolved questions** — a task blocked on a PLANNER
  question stays out of any dispatch group until answered

## Cost note

Parallel dispatch does not reduce total tokens spent — N independent
Haiku executor calls cost roughly the same whether run serially or
concurrently. What it saves is WALL-CLOCK TIME, not money. Use it when the
user is waiting on multiple independent small tasks, not as a token
optimization (token optimization is model tier routing + bounded context,
covered elsewhere).
