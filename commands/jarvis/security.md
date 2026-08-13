---
description: Run SOC 2-mapped security audit on current git diff or specified files. AI contextual analysis (Level 2).
argument-hint: [optional file paths] — defaults to git diff HEAD
---

@~/.claude/skills/jarvis/ledger/defects-schema.md

## Steps

### 1. Gather input

If `$ARGUMENTS` provided → read the specified files.
Otherwise → run `git diff HEAD` for current changes.

If both empty → report "nothing to audit" and stop.

### 2. Run Level 1 scanner first (if available)

Check if `scripts/security-agent.mjs` exists in project root.
If yes → run `node scripts/security-agent.mjs --json` first.
Report Level 1 findings briefly. Do NOT duplicate them in Level 2.

### 3. Invoke jarvis-security subagent

Invoke the `jarvis-security` subagent (Opus, `~/.claude/agents/jarvis-security.md`)
with the diff/files as input. It is read-only by design (no Write/Edit tools).

### 4. Parse JSON response

Expect strict JSON per security.md schema:

```json
{
  "verdict": "go-ahead" | "revise",
  "summary": "...",
  "findings": [...]
}
```

If JSON malformed → report and stop. Do NOT retry silently.

### 5. Write findings to docs/defects.md

For each `critical` or `high` finding:
- Append to `docs/defects.md` per `defects-schema.md` format
- Severity maps directly: critical → major, high → major, medium → minor, low → nit
- Include SOC 2 control in description: `[CC6.1] <issue>`

### 6. Print report

Keep this concise — one line per finding, no repeated false-positive
explanations beyond a single summary line. Every token spent here is a
token not available for the mandatory block in step 7 below, which MUST
appear in full regardless of how long this report runs.

```
── Security Audit ─────────────────────────────
Verdict: <go-ahead | revise>
Summary: <one line>

Level 1 (regex scanner): <N findings or "skipped">
Level 2 (AI review):     <N findings>

SOC 2 controls touched: CC6.1, CC7.1, ...

[CRITICAL] CC6.1 src/auth/token.ts:34
  Issue:    Token persisted to localStorage without httpOnly cookie
  Data flow: setAuthToken → Redux state → redux-persist → localStorage
  Fix:      Move token to server-set httpOnly cookie

[HIGH] CC7.1 src/api/users.ts:18
  Issue:    No server-side validation of req.body
  Fix:      Add Zod schema validation before passing to DB
───────────────────────────────────────────────
```

### 7. Mark findings as needing explicit go-ahead — do NOT let /jarvis:advance auto-pick these up

Security findings can involve real secrets (rotate a key), real auth flows
(token storage), or real data exposure — these deserve a human look before
anything touches them, unlike a routine lint defect from a normal PR review
round.

When writing each defect to `docs/defects.md` in step 5, append one extra line
to the entry that the loop's predicate logic checks before touching it:

```
**RequiresConfirmation:** yes
```

**MANDATORY — the question below MUST be the last thing you output,
regardless of how long the report above ran.** Paraphrasing it away,
shortening it to a generic "run /jarvis:advance" line, or skipping it
entirely is a failure of this command. List every defect ID found, then
ask plainly — no command-template menu, just a direct question the user
answers in their own words:

```
─────────────────────────────────────────────────
Found: <ID>, <ID>, <ID>, ...

Do you want me to fix these now?
─────────────────────────────────────────────────
```

Stop immediately after asking. Do not invoke any subagent after this. Do
not add a closing sentence after the question — the question IS the ending.

When the user replies, interpret it naturally — "yes" / "go ahead" / "fix
them" means all of them; naming specific IDs means only those; "not yet" /
"no" / "let me check something first" means none of them right now. There
is no fixed phrase to match — read the reply like a person would.

**Do NOT fix anything in this command** — `/jarvis:security` only audits
and asks. The fix itself happens only after you reply, via `/jarvis:advance`
or a direct instruction — see outer-loop.md's confirmation-gate handling.
