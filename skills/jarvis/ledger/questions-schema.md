# Questions Ledger Schema

## File: `./docs/questions.md`

Durable record of every clarifying question `jarvis-planner` asked and how
the user answered. Create if it does not exist (including the `docs/`
directory). Never delete entries — this is a history, not a scratch pad.

## Why this exists

`jarvis-planner` asks clarifying questions in a boxed table (see
jarvis-planner.md Step 2) when a request is ambiguous — but once the user
answers in chat, that exchange normally only lives in conversation history,
which gets summarized/compacted away over a long session. This file makes
the question AND the answer durable — you can open `docs/questions.md`
weeks later and see exactly what was asked and what was decided, without
digging through old chat transcripts.

This is a genuinely different concern from `docs/tasks.md`'s Completed
entries: a Completed entry explains what shipped and why; this file
explains what was asked BEFORE anything shipped, and what the user chose
among the options presented.

## Status lifecycle

```
asked → answered
asked → withdrawn   (planner moved forward without needing the answer —
                      e.g. investigation later resolved the ambiguity)
```

## Structure

One entry per question, in the order asked. Group by the milestone/goal
they were asked for.

## Entry schema

```markdown
### [Q-01] <the question, verbatim>
**Asked by:** jarvis-planner
**For:** <milestone or task this question was blocking, e.g. "M1: pagination">
**Date:** YYYY-MM-DD HH:MM
**Options presented:**
  a) <option a>
  b) <option b>
  c) Other — describe what you have in mind
**Status:** asked
**Answer:** <fill once the user responds — their exact words, even if it's
  "a" or a free-text description; do not paraphrase away nuance>
**Resolution:** <one line — what this answer changed in the plan, e.g.
  "Chose server-side pagination (b) — tasks.md PR-02 updated to build the
  RTK Query endpoint instead of client-side slicing">
```

## When to write an entry

Every time `jarvis-planner`'s Step 2 (clarifying questions table) fires —
write one entry per question in that table, `Status: asked`, before the
plan is written. When the user's answer arrives, fill `Answer:` and
`Resolution:`, flip `Status: answered`.

If the planner asks a question mid-conversation NOT through the formal
table format (a quick one-off "did you mean X or Y?") — still worth an
entry if the answer materially changed scope; skip it for truly trivial
back-and-forth that doesn't affect what gets built.

## What this is NOT for

- Bugfixer's `BLOCKED`/`DECLINED` reports — those belong in `docs/defects.md`
  (they're about a specific defect, not a planning ambiguity)
- Security findings needing confirmation — those live in `docs/defects.md`
  with `RequiresConfirmation: yes`, per defects-schema.md
- Casual conversation not tied to a specific planning decision — this file
  is for decisions that shaped the plan, not a transcript of everything said
