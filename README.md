# Jarvis — minimal harness for Claude Code

Loop-engineering harness inspired by [7mind/cq](https://github.com/7mind/cq), simplified for pure Claude Code (no Nix, no MCP server, no Rust).

## Architecture

```
jarvis.toml                  ← edit this to change agent model tiers
jarvis.context.md.example    ← per-project rules template (Review/Executor Rules)
├── commands/jarvis/         ← slash commands
│   ├── advance.md            /jarvis:advance — run full loop
│   ├── workflow.md           /jarvis:workflow — same loop, forced step-by-step narration
│   ├── fix.md                 /jarvis:fix — direct bugfixer call, skips planner/executor
│   ├── plan.md               /jarvis:plan — plan only
│   ├── review.md             /jarvis:review — review git diff
│   ├── status.md             /jarvis:status — show ledger state
│   ├── reviewers.md          /jarvis:reviewers — quick-test a model on disk
│   ├── security.md           /jarvis:security — SOC 2-mapped audit (Level 2)
│   └── perf.md                /jarvis:perf — performance audit, findings only
├── agents/                  ← PROPER Claude Code subagents (model: tier per agent)
│   ├── jarvis-planner.md        model: opus   — decomposes the request
│   ├── jarvis-executor.md       model: haiku  — implements one task
│   ├── jarvis-reviewer.md       model: opus   — adversarial review, read-only
│   ├── jarvis-bugfixer.md       model: sonnet — fixes defects/tests
│   ├── jarvis-explainer.md      model: haiku  — summarises diff at session end
│   ├── jarvis-security.md       model: opus   — SOC 2 contextual audit, read-only
│   ├── jarvis-visual-planner.md model: fable  — screenshot→plan (CONDITIONAL)
│   └── jarvis-perf.md           model: sonnet — perf audit, findings only, read-only
├── skills/jarvis/           ← loop discipline + ledger format (loaded via @ref)
│   ├── ledger/
│   │   ├── tasks-schema.md
│   │   └── defects-schema.md
│   └── loop/
│       ├── outer-loop.md        ← task drain + standalone defect drain (O2.5)
│       ├── inner-loop.md        ← I0 image detect → execute → review → fix
│       └── session-end.md
├── scripts/
│   ├── apply-tiers.mjs       ← reads jarvis.toml, writes model: into agents/*.md
│   ├── security-agent.mjs    ← Level 1 deterministic scanner (per-project)
│   └── SECURITY-SETUP.md     ← husky + CI integration guide
├── research/
│   └── perf-patterns.md      ← source of truth for jarvis-perf's patternMatch
│                                field (copied into each PROJECT, not ~/.claude*/ —
│                                jarvis-perf greps it directly from the repo)
├── docs/
│   └── architecture-concepts.md  ← agents-vs-skills, brief, jarvis.context.md
└── install.sh                ← applies tiers, copies files, creates jarvis.context.md
```

All of the above lives in THIS repo. `install.sh` copies `commands/`,
`agents/`, and `skills/` into `~/.claude/` (or `~/.claude-<project>/`),
creates `jarvis.context.md` in your project's git root, and copies
`research/perf-patterns.md` into the project's own `research/` directory
(same reasoning as `scripts/security-agent.mjs` — `jarvis-perf` reads it
directly via `grep`/`cat`, not via a subagent brief, so it has to
physically live in the project). `jarvis.toml` and `scripts/` stay in the
repo — you edit and re-run them here.

## Why agents/ is separate from skills/

This is the most important structural decision and it is easy to get wrong:

- **`skills/`** — instructions that load into the **current conversation**.
  The orchestrator (running `/jarvis:advance`) reads these directly via `@`
  references. They become part of the orchestrator's own context window and
  run on whichever model the orchestrator's session is using.

- **`agents/`** — proper Claude Code **subagents**. Each is a separate
  Markdown file with YAML frontmatter that includes a `model:` field. When
  the orchestrator invokes one by name (via the Task tool), Claude Code
  spawns it in its **own context window**, on **its own model**, and returns
  only the result. This is the mechanism that gives you real tier routing —
  Executor on cheap Haiku, Reviewer on expensive Opus — entirely within your
  Team subscription, no separate API billing.

Do not `@`-load agent files into a command's context. Claude Code
auto-discovers subagents from `~/.claude/agents/` and decides when to invoke
them based on their `description` field — loading their full prompt into the
orchestrator's context defeats the purpose (you'd pay the context cost twice).

## Install

```bash
# Default location (~/.claude/):
./install.sh

# Per-project CLAUDE_CONFIG_DIR setups (~/.claude-<name>/):
<<<<<<< HEAD
<<<<<<< HEAD
./install.sh your app
=======
./install.sh client
./install.sh client tg-octopus finfamily   # multiple at once
>>>>>>> 5a83346 (Initial Jarvis harness)
=======
./install.sh client
./install.sh client tg-octopus finfamily   # multiple at once
>>>>>>> c807dc6 (new harness)
```

Restart Claude Code fully after installing — subagent files are only loaded
at session start (unlike commands created via `/agents`, which apply live).

Verify:

```
/help     → "Custom commands" tab should list /jarvis:advance, /jarvis:plan, etc.
/agents   → "Library" tab should list jarvis-planner, jarvis-executor,
            jarvis-reviewer, jarvis-bugfixer, jarvis-explainer, jarvis-security
```

## Use

In Claude Code (any project):

```
/jarvis:advance "add pagination to ProductList"
```

The orchestrator reads the loop discipline, invokes `jarvis-planner` (Opus)
to decompose the work into `tasks.md`, then drives EXECUTOR (Haiku) → REVIEWER
(Opus) → BUGFIXER (Sonnet) cycles per task until the ledger is drained or
genuinely blocked.

**Want to watch it work step by step instead of waiting for a summary?**

```
/jarvis:workflow "add pagination to ProductList"
```

Identical loop, identical agents — the only difference is narration is a
hard requirement instead of a guideline. Every subagent call gets a
"→ invoking X" line before and a "✓ X done — outcome" line after, so you
see who's working and what happened as it happens, not just a spinner with
elapsed time. Use `/jarvis:advance` for routine work; use `/jarvis:workflow`
when debugging a slow run, demoing the harness, or watching a task you
want full visibility on.

**Already know exactly what's broken and just want it fixed?**

```
/jarvis:fix "TypeScript error in src/hooks/usePagination.ts:12 — Type 'number' is not assignable to type 'string'"
```

Skips `jarvis-planner` (Opus decomposition) and `jarvis-executor` entirely
— goes straight to a single `jarvis-bugfixer` (Sonnet) call. This is the
right tool when you already know the bug and the full plan→execute→review
cycle would just be paying for steps that don't apply. It does NOT
auto-chain into a review afterward — run `/jarvis:review` separately if you
want the fix checked. Wrong tool for new features or vague requests
("make this better") — the command itself will tell you to use
`/jarvis:advance` instead if the ask doesn't fit a direct fix.

Other commands:

```
/jarvis:plan "task description"   # plan only, don't execute
/jarvis:review                    # adversarial code review on git diff
/jarvis:status                    # show ledger state
/jarvis:security                  # SOC 2-mapped security audit (Level 2 AI)
<<<<<<< HEAD
=======
/jarvis:perf src/components/Foo.tsx  # performance audit — findings only, never edits code
>>>>>>> c807dc6 (new harness)
/jarvis:reviewers opus-5          # quick-test a new model release, see below
```

## Model tiers (cost control without leaving your subscription)

```
jarvis-planner   → opus    (deep decomposition, runs once per milestone)
jarvis-executor  → haiku   (narrow context, runs most often — cheap)
jarvis-reviewer  → opus    (adversarial review needs the strongest model)
jarvis-bugfixer  → sonnet  (focused fix from a clear defect description)
jarvis-explainer → haiku   (simple diff summarisation)
jarvis-security  → opus    (contextual data-flow analysis)
```

Claude Code does not read TOML natively — each subagent's model comes from
the `model:` field in its own frontmatter file. `jarvis.toml` is a
convenience layer on top of that: edit one file, run one script, and the
resolved model gets written into all 6 agent frontmatter blocks at once.

```bash
# Edit jarvis.toml, e.g. downgrade reviewer for a cheap refactor pass:
#   [agent_tiers]
#   jarvis-reviewer = "standard"

node scripts/apply-tiers.mjs   # writes the resolved model into agents/*.md
./install.sh                   # re-runs apply-tiers.mjs automatically, then copies
```

`./install.sh` always re-applies `jarvis.toml` before copying — you never
need to run `apply-tiers.mjs` manually unless you want to preview the
change without installing yet.

**Pinning a specific model version instead of a floating alias:** each
tier in `[tiers]` accepts either a bare alias (`haiku`, `sonnet`, `opus`,
`fable` — Claude Code resolves these to whatever it currently considers
default) or a pinned version string (`claude-sonnet-4-6`,
`claude-opus-4-8`) that locks the tier to an exact model regardless of
what the alias later points to.

```toml
[tiers]
standard = "claude-sonnet-4-6"   # pinned — this exact model, always
frontier = "opus"                # floating — whatever "opus" currently means
```

`apply-tiers.mjs` flags pinned tiers with `[pinned]` in its output table so
it's visible at a glance which agents are locked to a specific version:

```
│  jarvis-reviewer        frontier  → claude-opus-4-8      [pinned]
│  jarvis-executor        fast      → haiku
```

Use pinning when you want reproducible behavior across runs, or you
specifically want a newer/older point release than the alias currently
resolves to. Verify the exact model id against Claude Code's current
model list before pinning — an unrecognized id will fail to spawn the
agent, not silently fall back to something else.

**Known limitation:** some Claude Code versions have shipped with the
`model:` frontmatter field not being respected at runtime (subagents fall
back to the parent session's model). If you notice all subagents running on
the same model regardless of their frontmatter, check `claude --version`
against the Anthropic changelog, or force tiers session-wide with:

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=sonnet
```

## `/jarvis:reviewers` — testing a new model release quickly

When Anthropic ships a new model and you want to try it on REVIEWER without
editing `jarvis.toml` and re-running `./install.sh`:

```
/jarvis:reviewers opus-5
```

**This is a real file edit, not a session-only override.** Subagent models
are resolved from frontmatter on disk at invocation time — there is no
mechanism in Claude Code to override that from chat context alone. So this
command patches `~/.claude/agents/jarvis-reviewer.md` directly (printing the
old value so you can revert), tries the new model, and reminds you that:

- the patch persists across Claude Code restarts (it's a real file, not memory)
- `jarvis.toml` is still the source of truth — the next `./install.sh` will
  silently overwrite this manual patch back to whatever the toml says
- to revert immediately: `/jarvis:reviewers opus` (or whatever the printed
  "Before" value was)
- to make a model change *permanent*: edit `jarvis.toml`, not this command

## Token economy — bounded context per agent

Model tiers are one axis of cost control (cheap model for frequent work).
The second axis is **how much each agent reads**. The biggest silent token
leak in agentic loops is the planner reading half the repo during
reconnaissance, and agents `cat`-ing whole files when a `grep` would do.

Instead of an external compression service (proxy/MCP), Jarvis controls
cost at the source — each agent has a reading budget baked into its prompt:

- **jarvis-planner** — max ~10 tool calls for investigation; `grep -n`
  never `cat` whole files; if it can't scope the task in 10 calls, that's a
  signal to split the milestone, not read more. Plan output stays lean
  (2-4 lines per PR) — implementation detail is derived by the executor at
  run time, not pre-written in the plan.
- **jarvis-executor** — max 2 files per step; grep symbols, never read
  entire CSS/locale files; never touch node_modules/dist/.next.
- **jarvis-reviewer** — `git diff HEAD` only, never full files.
- **jarvis-explainer** — max 3 tool calls; the diff is enough, don't
  re-read files after the work is done.

This is the same 60-90% saving a context-compressor promises, but without a
Rust proxy in the request path and without the risk of a compressor
silently dropping a line of code the reviewer needed.

## Two-level security

**Level 1 — `scripts/security-agent.mjs`** (deterministic, free)
- 16 regex rules across 7 categories (secrets, Next.js leaks, XSS, data leaks, TLS, crypto, SQL injection)
- Each rule mapped to a SOC 2 Trust Service Criterion (CC6.1, CC7.1, etc.)
- Runs on pre-commit via husky + lint-staged
- Hard-fails (exit 1) on critical/high → commits blocked
- `--json` output → machine-readable audit trail (SOC 2 evidence)
- Suppress false-positives with `// sec-ignore <reason>` inline

**Level 2 — `jarvis-security` subagent** (Opus, AI contextual analysis)
- Data flow tracing, authorization checks, IDOR detection
- Writes findings to `defects.md` → `/jarvis:advance` fixes them
- Use per-PR or on-demand via `/jarvis:security`

See `scripts/SECURITY-SETUP.md` for husky + CI integration.

## File-isolation sandbox (macOS)

Two independent layers keep agents inside the paths and commands they need:

```
Agent frontmatter (tools:)   → which TOOLS an agent has at all
                               (reviewer/security have no Write — can't edit)
.claude/settings.json        → which PATHS/COMMANDS any tool may touch
                               (executor can only write src/, tests/, docs/)
macOS sandbox block          → which paths Bash SUBPROCESSES may reach
                               (closes the gap deny rules leave for subprocesses)
```

The permission rules (`deny > ask > allow`) block Claude's own tools; the
macOS `sandbox` block stops subprocesses spawned by allowed commands from
wandering outside the project. Deny always wins — agents literally cannot
read `.env`/`*.pem`/`secrets/` or run `rm -rf`/`curl`/`wget`.

This is the preventive counterpart to `jarvis-security`: the audit finds
leaks that already exist, the sandbox stops new ones from being created.

Install alongside the harness (not the default — path globs are
project-specific, a wrong glob blocks legitimate writes, not just risky
ones):

```bash
./install.sh client --sandbox
# review .claude/settings.json afterward — adjust Edit/Write globs to your
# real layout (src/ vs app/ vs lib/) before trusting it fully
```

Or add it later without re-running the full install:

```bash
cp settings.sandbox.json.example client/.claude/settings.json
```

Without `--sandbox`, `install.sh` just prints a reminder that it's
available — it never silently installs something that could block writes
you didn't expect.

Full guide: `docs/sandbox-setup.md`.

## How it differs from cq

| | cq | Jarvis |
|---|---|---|
| Distribution | Nix home-manager module | Plain `.md` files + `install.sh` |
| Ledger storage | MCP server (`ledger-mcp`) over stdio/HTTP, 18 tools | Direct file read/write of `tasks.md`/`defects.md` |
| Multi-agent harness | Claude Code + Codex + Pi via `cq.toml` aliases | Pure Claude Code |
| Item types | 6 (tasks, defects, hypotheses, questions, decisions, goals) + milestone DAG | 2 (tasks, defects) — extend as needed |
| Subagents | `.codex/agents/*.toml`, `cq-assets/agents/` (Nix-packaged) | `~/.claude/agents/jarvis-*.md` (plain files, `model:` frontmatter) |
| Stop predicates | `mcp__ledger__derive_predicates` | Computed manually from tasks.md/defects.md |

## Extend

Customise per-project: drop a project-local `.claude/agents/jarvis-executor.md`
into the project root with project-specific rules (e.g. "use
jest.unstable_mockModule", "Server Components by default"). Project-scoped
agents in `.claude/agents/` outrank user-scoped ones in `~/.claude/agents/`
when names collide.

Add new agents: create `~/.claude/agents/jarvis-<name>.md` following the
existing frontmatter pattern (`name`, `description`, `tools`, `model`), then
reference it by name from the loop skill that needs it — never `@`-load its
content into another file's context.
