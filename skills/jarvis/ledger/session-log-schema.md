# Session Log Schema

The session log is a durable, append-only audit trail of every agent action:
what agent ran, when, which files it touched, what it did, and what comes next.

Location: `.jarvis/session-log.md` in the project root.

## Why this exists

The ledger (`tasks.md`, `defects.md`) shows WHAT state things are in.
The session log shows the STORY of how they got there — a timeline you can
scan to answer "what did the executor actually touch in PR-02?" or "why did
review take 3 rounds?" without re-reading the whole conversation.

Append-only: never rewrite past entries. Each entry is one agent action.

## Entry format

Each entry is a block. The orchestrator appends one after every subagent
returns:

```markdown
### 14:42 · EXECUTOR · PR-02
**Task:** Add usePagination hook to ProductList
**Model:** haiku
**Files touched:**
  - src/hooks/usePagination.ts (created)
  - src/components/ProductList/ProductList.tsx (modified)
**Did:** Created usePagination hook with page/pageSize state; wired
  ProductList to RTK Query getProducts with page param.
**Tokens:** ~25k · **Tool calls:** 19
**Next:** REVIEWER checks PR-02 diff
```

## Field reference

- **Header line:** `### HH:MM · AGENT · <task/PR id>`
  - time (24h), agent name in caps, which task or PR this action belongs to
- **Task:** one line — what this agent was asked to do
- **Model:** which tier actually ran (haiku/sonnet/opus/fable)
- **Files touched:** each file with an action tag:
  `(created)` `(modified)` `(deleted)` `(read-only)` `(renamed)`
  - REVIEWER and SECURITY are read-only — list files they inspected as
    `(read-only)`
- **Did:** 1-2 sentences, past tense — what actually happened
- **Tokens / Tool calls:** rough usage if available (from Claude Code's
  own reporting); omit if not known — never fabricate numbers
- **Next:** what the orchestrator will do after this step — gives the log
  a forward-looking "what's happening now" quality

## Session boundaries

Start each session with a header:

```markdown
## Session 2026-07-07 · 14:20
Goal: <one line — what this session is working toward>
---
```

End each session with the handoff state (mirrors session-end.md):

```markdown
---
### 15:10 · SESSION END
**State:** DRAINED | BLOCKED-ON-QUESTIONS | BLOCKED | MIXED
**Completed:** PR-01, PR-02, PR-03
**Open:** none
**Summary:** <one line>
```

## Reading the log

`/jarvis:status` reads this file and shows the recent timeline plus current
ledger state. The raw file is also human-readable — open it directly.

## Cost note

Writing to this log is orchestrator work (append a text block) — it costs
almost nothing and does NOT consume subagent tokens. The subagents don't
know the log exists; the orchestrator records what they did after they
return.
