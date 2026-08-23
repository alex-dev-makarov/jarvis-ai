# Tasks Ledger Schema

## File: `./docs/tasks.md`

The authoritative ledger of all planned and completed work.
Create if it does not exist (including the `docs/` directory). Never
overwrite — always append.

## Why this schema is a TABLE, not prose

Earlier versions of this schema used word-count limits ("~30 words max",
"one line per decision") on free-text sections. In practice, across many
sessions, those limits eroded — a planner writing under time pressure or
mid-investigation naturally reaches for prose to explain a mechanism, and
"keep it brief" is not a hard constraint the same way a table column is.
A milestone that accumulates paragraph-length "Рішення"/"Explicitly out of
scope" sections is not a planner failing to follow instructions once — it
is what happens when the format itself allows prose at all.

**The fix: no free-text sections in this file, ever.** Every entry is a
table row with fixed columns. A table row cannot silently grow into a
paragraph — there is no column for one. Full reasoning, code mechanisms,
quoted line numbers, and "why we rejected X" narratives ALWAYS go in the
plan doc (`docs/drafts/YYYYMMDD-HHMM-<name>.md`), never here, because
there is structurally nowhere in this file's format to put them.

## Status markers

```
[ ] planned   ·   [~] in progress   ·   [x] done   ·   [!] blocked
```

## Required sections (in order)

### 1. Milestones (high-level)

One row per milestone.

```
| Milestone | Status | Plan |
|---|---|---|
| M1 — Auth OTP Telegram login | done | docs/drafts/20260811-1730-auth-drawer-otp-telegram-login.md |
| M2 — RTK Query baseApi consolidation | in progress | docs/drafts/20260812-2123-rtk-query-baseapi-consolidation.md |
```

### 2. Current milestone — PR table

One row per PR. Five columns, exactly these, nothing more:

```
| PR | Status | Problem | File | Fix |
|---|---|---|---|---|
| PR-01 | done | GTM blocks main thread on every route | src/app/[lang]/layout.tsx | Idle-gate via requestIdleCallback, 2s fallback |
| PR-02 | done | Chat panel ships even when never opened | src/components/ui/GlobalChatPanel/index.ts | dynamic(ssr:false) + conditional mount |
| PR-03 | planned | i18n bundles both locales always | src/config/i18n.ts | Split into uk.ts/ru.ts, per-locale wrapper |
```

**Column rules — enforced, not suggested:**
- **Problem:** one clause, what's wrong. No mechanism explanation, no
  numbers, no "because X causes Y" — that's the plan doc's job.
- **File:** the primary file(s). If more than 2-3, write the first one
  and `+N more — see plan doc`, don't list them all in the cell.
- **Fix:** one clause, what changes. Not how it works internally.
- **If a row's Problem or Fix cell would need more than ~12 words to be
  honest** — that is the signal the detail belongs in the plan doc, and
  this cell should instead say `see plan doc` plus the 3-6 word gist.
- `dependsOn: PR-NN` goes in a 6th column only when present, omit the
  column entirely for milestones where nothing depends on anything (don't
  pad every row with an empty dependsOn cell).

Optional 6th column, only if any row in this milestone needs it:

```
| PR | Status | Problem | File | Fix | dependsOn |
|---|---|---|---|---|---|
| PR-04 | planned | ... | ... | ... | PR-03 |
```

This is read by `parallel-subagents.md` when deciding what can run
concurrently.

### 3. Architectural decisions (locked)

One row per decision. Not a paragraph, not a bullet with a rationale
clause attached — a row.

```
| Decision | Lands in | Reason (one clause) |
|---|---|---|
| httpOnly cookies for auth tokens, not localStorage | PR-02 | XSS surface |
| No experimental.optimizeCss | — | Breaks CSS-variable rules (see plan doc) |
```

If the "Reason" column needs more than ~8 words to be honest, write
`see plan doc` there — do not let the cell become a sentence explaining
the investigation.

**Rejected alternatives get their own table, not a bulleted list with
paragraphs:**

```
| Rejected | Why (one clause) |
|---|---|
| experimental.cssChunking: 'strict' | Measured worse: 30 files/258KB vs 17/231KB |
| React → Preact | Ecosystem compatibility risk, last resort only |
```

### 4. Completed

One row per finished PR, pointing to the full report — never inline detail.

```
| PR | Scope | Report |
|---|---|---|
| PR-01 | GTM idle-gate | completed-log.md#pr-01 |
| PR-02 | Chat panel lazy-load | completed-log.md#pr-02 |
```

Why the split: a full prose report per PR (verification traces, notes,
metrics, cost) bloats docs/tasks.md fast — after 20 PRs, scanning for
"what's still open" means scrolling past 20 dense paragraphs. tasks.md
stays a scannable ledger; completed-log.md is where the detail lives for
whoever wants to read it later.

## What NEVER appears in docs/tasks.md — goes in the plan doc instead

- Code mechanisms, quoted line numbers, function names beyond a File cell
- Multi-sentence "why" explanations for any decision
- Measured numbers (bytes, ms, percentages) beyond what fits a table cell
- Risk analysis, verification protocols, acceptance criteria prose
- "Explicitly out of scope" narrative — use the Rejected table above instead
- Any paragraph. If you're writing a paragraph, stop — it belongs in
  `docs/drafts/YYYYMMDD-HHMM-<name>.md`, and this file gets a table row
  with `see plan doc` in whichever cell would otherwise hold it.

## Rules

- Flip `[ ]` → `[~]` when work starts
- Flip `[~]` → `[x]` AND add the Completed table row when a PR merges
- Never delete rows — append only
- When milestone closes: migrate its PR table to
  `./docs/archive/tasks-<milestone-id>.md`, leave the Milestones row
  pointing there; completed-log.md entries stay put (already archival)

## Skeleton

```markdown
# <Project> — Task Ledger

Status: `[ ]` planned · `[~]` in progress · `[x]` done · `[!]` blocked

## Milestones

| Milestone | Status | Plan |
|---|---|---|
| M1 — <goal> | in progress | docs/drafts/YYYYMMDD-HHMM-m1.md |

## M1 — PR table

| PR | Status | Problem | File | Fix |
|---|---|---|---|---|
| PR-01 | done | ... | ... | ... |
| PR-02 | planned | ... | ... | ... |

## Architectural decisions (locked)

| Decision | Lands in | Reason (one clause) |
|---|---|---|
| ... | PR-01 | ... |

| Rejected | Why (one clause) |
|---|---|
| ... | ... |

## Completed

| PR | Scope | Report |
|---|---|---|
| PR-01 | ... | completed-log.md#pr-01 |
```