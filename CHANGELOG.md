# Jarvis Changelog

## Latest — jarvis-perf agent (performance audits, findings only)

New 8th agent: `agents/jarvis-perf.md` (Sonnet — same tier class as
bugfixer, tradeoff judgement). Audits a declared scope (one file/route,
whole project only if explicitly asked) for unused JS/CSS and lazy-load
candidates. Writes findings ONLY to `docs/perf-findings.md` — no Write/Edit
access to source code, removal goes through the normal advance-gate
(user confirms → jarvis-executor executes → logs to docs/completed-log.md).

- Every finding gets independent desktop AND mobile verdicts — never a
  single boolean; explicit divergence callout when they differ
- Verdict vocabulary is exactly five terms: `remove` · `lazy` · `eager` ·
  `ssr-false-required` · `defer-third-party` (third-party scripts get
  deferred, never removed — their bytes don't tree-shake)
- Three detection tiers: Tier 1 (always, pure static grep/read) / Tier 2
  (chunk contents, dead-part/duplicate-function patterns — only on
  request) / Tier 3 (runs an EXISTING coverage script only — never writes
  its own browser automation)
- `patternMatch` field compares against `research/perf-patterns.md` only —
  never invents a resemblance; "no comparable pattern on file" if nothing
  matches
- `howFound` field mandatory, specific, reproducible — quoted verbatim by
  jarvis-executor when it later acts on a finding
- Tool-call budget ~8-12, scope discipline (never expands beyond what was
  asked)

New reference file: `research/perf-patterns.md` — two case studies (eBay:
payload trim, predictive prefetch, edge-cached autosuggest with the
personalization-in-cache-key caveat; Treebo: bundle analyzer, moment.js
dead-locale-data pattern, qs/query-string duplicate-by-function pattern,
PRPL code-splitting, SW precaching, React→Preact as last-resort). This file
lives in the project (like `scripts/security-agent.mjs`) — `install.sh`
copies it in via a new Step 3.5, never overwriting an existing copy.

New command: `/jarvis:perf <scope>` — explicit entry point, requires a
scope (won't silently audit the whole project), ends with a plain
confirmation prompt before any fix work is handed to jarvis-executor.

## Latest — token economy + audit trail + visual pipeline

### Token economy (bounded context per agent)
Attacks the biggest silent cost leak — planner reading half the repo and
agents `cat`-ing whole files. Same 60-90% saving a context-compressor
(headroom etc.) promises, but with no external proxy in the request path and
no risk of dropping a needed line of code.

- **jarvis-planner** — reconnaissance capped at ~10 tool calls; `grep -n`
  instead of `cat` whole files; if scope needs >10 calls, split the
  milestone instead of reading more. Plan output kept lean (2-4 lines per
  PR) — implementation detail is derived by executor at run time, not
  pre-written in the plan doc. (Was: planner ate ~136k / 35% of a 390k
  session on recon alone.)
- **jarvis-explainer** — capped at 3 tool calls; diff is enough, don't
  re-read files after work is done.
- **jarvis-executor / jarvis-reviewer** — already bounded (2 files/step,
  diff-only) — confirmed, unchanged.

### Session log — per-action audit trail
New `.jarvis/session-log.md` (append-only). Orchestrator writes one entry
after every subagent returns: time, agent, model, files touched (with
created/modified/read-only tags), what it did, what's next.

- New schema: `skills/jarvis/ledger/session-log-schema.md`
- `inner-loop.md` — logging directive at top (write entry after each subagent)
- `session-end.md` — appends SESSION END entry with handoff state
- `/jarvis:status` — now shows recent timeline + "▶ CURRENTLY" line;
  `/jarvis:status timeline` prints full history
- Costs ~nothing (orchestrator text append, not subagent tokens)
- Keep out of git: `echo '.jarvis/' >> .git/info/exclude`

### Screenshot-to-code pipeline (conditional)
Fable (expensive vision tier) used ONLY to read a screenshot and produce a
compact plan — never to generate code.

- New agent: `agents/jarvis-visual-planner.md` (model: fable, ≤600 token
  plan output, no code, scans codebase for reusable components first)
- `jarvis.toml` — new `visual` tier + `[pipeline.screenshot_to_code]` section
- `apply-tiers.mjs` — parses `[section.subsection]` + unquoted ints;
  annotates conditional agents; prints pipeline summary
- `inner-loop.md` — new I0 step: detect image → invoke visual-planner
  (90s timeout → fallback to jarvis-planner) → inject plan into executor
  brief. No image → I0 skipped, Fable never touched. Reviewer (Opus) gets
  screenshot + code for fidelity; Fable not called twice.

### Per-project context (jarvis.context.md)
Solves: global inner-loop can't know local skill names (differ per project).

- Standard filename `jarvis.context.md` in project root — same name, different
  content per project
- `inner-loop.md` reads it, passes `## Review Rules` to reviewer brief and
  `## Executor Rules` to executor brief
- `install.sh` auto-creates a template in the git project root (never
  overwrites existing)
- Template: `jarvis.context.md.example`

### Security confirmation gate
- `/jarvis:security` marks every finding `RequiresConfirmation: yes`, ends
  with a plain "Do you want me to fix these now?" — no fixes without reply
- `outer-loop.md` O2.5 — drains standalone defects but SKIPS anything marked
  RequiresConfirmation until user approves; interprets natural-language
  replies (not fixed command phrases)
- `jarvis-security.md` — extended with OWASP Session Management + Authorization
  cheat sheet specifics (localStorage ban, full cookie triple
  HttpOnly+Secure+SameSite, __Host- prefix, Cache-Control: no-store, IDOR
  CWE-639, ReBAC ownership checks, reauth after risk events)

### Planner clarifying questions (cq-style)
- `jarvis-planner.md` — asks questions in a boxed table with a/b/c options
  (c always "Other — describe what you have in mind"), ends with "Next step",
  STOPS until answered before touching tasks.md

### Model tier routing (jarvis.toml)
- `jarvis.toml` + `scripts/apply-tiers.mjs` — edit tiers in one file, script
  writes resolved `model:` into all agent frontmatter; `install.sh` runs it
  automatically before copying
- `/jarvis:reviewers <model>` — quick-test a new model release by patching
  reviewer frontmatter on disk (honest about being a real file edit, with
  revert instructions)

## Agents (8)
```
jarvis-planner        opus    decompose + clarifying questions (bounded recon)
jarvis-executor       haiku   implement one task (2 files/step)
jarvis-reviewer       opus    adversarial review, read-only (diff only)
jarvis-bugfixer       sonnet  fix defects, read-only scope
jarvis-explainer      haiku   session-end diff summary (3 tool calls max)
jarvis-security       opus    SOC 2 + OWASP contextual audit, read-only
jarvis-visual-planner fable   screenshot→plan, CONDITIONAL, no code
jarvis-perf            sonnet  perf audit findings only, read-only (~8-12 calls)
```

## Not a local LLM
Jarvis is `.md` instruction files that steer cloud Claude via Claude Code —
not a model itself, not local. Works fully within the Team subscription.
(A local/hybrid setup would require the SDK version, which bills separately.)
