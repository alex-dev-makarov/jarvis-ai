# Jarvis Sandbox Setup (macOS) — file isolation for agents

Claude Code can read files, write files, and run shell commands across your
whole filesystem by default (limited to the working directory tree, but that
still includes everything under your project — and Bash subprocesses can
wander further). This guide locks agents to exactly the paths and commands
they need.

## Two layers, used together

**Layer 1 — Permission rules** (`allow` / `ask` / `deny` in settings.json)
Control what Claude's OWN tools (Read, Edit, Write, Bash) are allowed to do.
Evaluated `deny > ask > allow` — a deny always wins.

**Layer 2 — Sandbox** (macOS, the `sandbox` block)
Stops Bash CHILD PROCESSES from reaching paths outside the project, even if
Claude decides to try. This matters because — per Claude Code's own docs —
`Read`/`Edit` deny rules apply to Claude's file tools and recognized file
commands, but they do NOT stop an arbitrary subprocess (e.g. a script that
a build step spawns). The sandbox closes that gap.

Use both. Permission rules catch Claude's decisions; the sandbox catches
whatever slips past into a subprocess.

## Install

```bash
# from your project root
mkdir -p .claude
cp ~/Desktop/jarvis-final/settings.sandbox.json.example .claude/settings.json
```

Then strip the `//_*` comment keys if your Claude Code version is strict
about unknown keys (most tolerate them; remove if you see warnings).

Restart Claude Code for settings to load.

## Where to put it — three scopes

| File | Scope | Committed to git? |
|---|---|---|
| `.claude/settings.json` | team-shared project rules | yes |
| `.claude/settings.local.json` | your personal overrides | no (gitignore it) |
| `~/.claude/settings.json` | applies to ALL your projects | n/a (user home) |

Precedence (highest wins): managed > CLI > local > project > user.

## What the template does

**Allowed freely (no prompt):**
- All reads/greps/globs (reading is low-risk)
- Edits and writes ONLY inside `src/`, `tests/`, `docs/`, `.jarvis/`
- Ledger files: `tasks.md`, `defects.md`
- Safe git (status, diff, log, add)
- Build/test: `npm/pnpm run`, `jest`, `tsc`
- The Level-1 security scanner

**Asks first (reversible, worth a glance):**
- `git commit`, `git push`, `git checkout`, `git reset`
- `rm`, `mv`

**Hard denied (blocked, deny wins over all):**
- Reading any `.env`, `*.pem`, `*.key`, `secrets/`, `credentials*`
- Reading `~/.ssh`, `~/.aws`, `~/.config`, shell rc files
- Editing lockfiles (agents shouldn't hand-edit these)
- `rm -rf`, `curl`, `wget`, `ssh`, `scp`, `sudo`, force-push

## Why these specific denies matter for Jarvis

Remember the security audit that found `access_token` in localStorage and a
Firebase key in a committed file? The deny list here is the preventive side
of that — an agent literally cannot read your `.env` to "helpfully" inline a
secret, and cannot `curl` a secret out. `jarvis-security` finds leaks that
already exist; the sandbox stops new ones from being created.

## Tuning it

Start strict, loosen as real work reveals friction:

1. Run a normal `/jarvis:advance` session for a day
2. Note what prompted that shouldn't have → move to `allow`
3. Note what ran that shouldn't have → move to `deny`
4. Within a week the prompts fade and the dangerous stuff stays blocked

Adjust the `Edit`/`Write` path globs to match your project layout — if your
code lives in `app/` and `lib/` instead of `src/`, change the globs
accordingly.

## Interaction with Jarvis agents

The read-only agents (`jarvis-reviewer`, `jarvis-security`) already declare
`tools: Read, Bash, Grep, Glob` with no Write/Edit in their frontmatter —
that is agent-level isolation. This sandbox is the PROJECT-level layer
underneath: even the write-capable agents (`jarvis-executor`,
`jarvis-bugfixer`) can only write where the settings.json allows. Two
independent guarantees:

```
Agent frontmatter (tools:)   → which TOOLS an agent has at all
settings.json (permissions)  → which PATHS/COMMANDS any tool may touch
sandbox (macOS)              → which paths subprocesses may reach
```

A reviewer with no Write tool physically cannot edit. An executor with a
Write tool can still only write to `src/`, `tests/`, `docs/`, `.jarvis/`.
