# Why use Jarvis instead of plain Claude Code?

Honest answer: **for some tasks plain Claude is enough. For others Jarvis adds real value.** Here is what you get, and where it costs more than it gives.

---

## The plain Claude Code workflow

```
You: "add pagination to ProductList"
Claude: <writes code>
You: "looks good but missing aria-labels"
Claude: <fixes>
You: "now the API call is wrong"
Claude: <fixes>
You: "tests are failing"
Claude: <fixes>
...
```

You drive every step. You decide when it is done. You remember what to check.
You hold the discipline. **You are the orchestrator.**

This works fine for small, focused changes — and is often the right tool.

---

## What Jarvis adds

### 1. Discipline that does not depend on your memory

Every task goes through the same loop:

```
PLANNER → EXECUTOR → REVIEWER → (revise?) → REVIEWER → done
```

The adversarial REVIEWER runs **every time**, with the same checklist
(correctness, types, accessibility, tests, scope creep, ESM mock order,
weak `any` usage). You cannot forget to check accessibility because
Reviewer always checks. You cannot skip security review on auth changes
because `/jarvis:security` writes findings to `defects.md` that block
the task until fixed.

**Plain Claude:** discipline = your willpower.
**Jarvis:** discipline = the loop, written down once.

### 2. Durable memory across sessions

`tasks.md` and `defects.md` are markdown files in your project root.
You can run `/jarvis:advance`, walk away mid-task, come back tomorrow,
run `/jarvis:advance` again — it resumes from `[~]` in progress.

The agent forgets between sessions. The repo does not.

**Plain Claude:** when context fills up or you start a new session, state is gone.
**Jarvis:** state lives in `tasks.md`. Next session resumes exactly where you stopped.

### 3. Resists the "looks done, ship it" drift

The REVIEWER agent is told explicitly: *adversarial, hostile, technically
precise, zero patience for mediocre code*. It is a separate persona spawned
in a separate subagent — it does not have ego in the code that EXECUTOR
just wrote. The maker is not the checker.

`outer-loop.md` lists forbidden stop rationalisations explicitly:
"deliberate checkpoint", "warrants fresh context", "large change — better
fresh", "I have done enough this turn". If the loop tries to stop on any
of those — it should not.

**Plain Claude:** easy to say "good enough, ship". Easier when you are tired.
**Jarvis:** Reviewer says go-ahead or revise. There is no "good enough".

### 4. SOC 2-mapped security on every commit

`scripts/security-agent.mjs` runs on pre-commit via husky:

- 16 regex rules across 7 categories (secrets, XSS, TLS, crypto, SQL injection, etc.)
- Each rule mapped to a SOC 2 Trust Service Criterion (CC6.1, CC7.1, etc.)
- Hard-fails the commit (exit 1) on critical/high findings
- `--json` mode → machine-readable audit trail for SOC 2 evidence

When you need contextual analysis (data flow, IDOR, authorization holes)
that regex cannot do, `/jarvis:security` runs the Level 2 AI audit.

**Plain Claude:** "remember to check for hardcoded secrets". Sometimes you do.
**Jarvis:** the scanner refuses to let the commit through.

### 5. Per-PR audit trail

Every PR through Jarvis produces:

- `tasks.md` Completed entry with `Metrics: review rounds N; defects major:N, minor:N, nit:N`
- `defects.md` entries with location, root cause, fix, reproduce-first test
- Optional session log under `docs/logs/`

You can answer "why was this fix made?" by reading the ledger.
You can answer "what review rounds did this go through?" — the metrics line.

**Plain Claude:** git log + your memory + Slack history.
**Jarvis:** the ledger.

---

## Where Jarvis is overkill

Be honest — do not use Jarvis when:

- **One-off scripts or experiments.** Spinning up the full loop for a 10-line
  prototype is friction without payoff. Just talk to Claude.
- **Quick fixes you understand fully.** "Rename this variable across the file"
  does not need PLANNER → EXECUTOR → REVIEWER → ledger. Just edit.
- **Pair-programming-style flow** where you want tight back-and-forth on each
  line. Jarvis adds latency between you and the code (subagents in between).
- **Throwaway proofs of concept** where the discipline overhead exceeds the
  value of the artefact.

The loop is for work that is **worth being durable** — features, refactors,
bug fixes that ship. Not for thinking out loud.

---

## What Jarvis does NOT do

- **Does not save tokens.** With pure `.md` files in Claude Code there is
  no tier routing — every subagent runs on whichever model the harness uses.
  When Anthropic exposes per-call model selection in subscription, we add
  tier routing. Until then this is plain subscription usage.
- **Does not replace your judgement.** The Reviewer can miss things.
  You still review the diff before shipping.
- **Does not make you SOC 2 compliant.** It produces *evidence of one
  control* (vulnerability detection in code review). SOC 2 needs much more —
  access policies, encryption, vendor management, incident response.
- **Does not magically improve bad task descriptions.** "Make it better"
  yields "made it better". Garbage in, garbage out — the loop included.

---

## When Jarvis is genuinely worth it

| Situation | Why Jarvis helps |
|---|---|
| Multi-file feature you will ship to production | Loop catches scope creep, Reviewer enforces patterns |
| Touching auth, payments, PII | Security scanner + `/jarvis:security` audit |
| Working across multiple sessions on one feature | Durable ledger resumes state |
| Onboarding new engineer to your conventions | The skills `.md` files document your standards |
| Codebase with strict patterns (Next.js App Router boundary, RTK Query tags, ESM mocks) | EXECUTOR and REVIEWER skills encode the rules; nobody forgets |
| SOC 2 / audit preparation | Pre-commit scanner produces audit-trail JSON |
| Working with a teammate who needs to pick up where you stopped | `tasks.md` is the handoff |

---

## The honest summary

Jarvis is a **discipline harness, not a productivity tool**.
It does not make Claude faster. It makes you more consistent.

If you are already disciplined (rigorous review, durable notes, never skip
accessibility checks, never ship without security review) — Jarvis encodes
what you already do, with less mental tax.

If you are *not* yet disciplined — Jarvis externalises the discipline so
the tool does not let you skip it. That is the real value.

The cost is friction on small tasks. Pay it where the work is worth being durable.
