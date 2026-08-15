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

## "I gave it sandbox access, why does it still ask me things?"

This is the most common confusion, so it gets its own section. The sandbox
controls file/path/command PERMISSIONS — it does not mean "never ask
anything ever again." Two specific reasons prompts still show up:

**1. A Bash command doesn't match anything in `allow` or `deny`.** Claude
Code's default for an unmatched command is to ASK, not to allow. If your
project runs `yarn` instead of `pnpm`, or a script not in the template's
`allow` list, every one of those commands prompts you individually — not
because Jarvis is being cautious, but because the sandbox config simply
doesn't mention that command yet. The fix is almost always: **add the
specific command to `permissions.allow`**, not to loosen `defaultMode`.
The v2 template below is deliberately wide — it covers test runners,
linters, tsc, git read-only operations, and both Jarvis scripts — but your
project's exact toolchain may still need something added (a different
package manager, a custom build script, etc).

**2. `defaultMode` is `acceptEdits`, not `bypassPermissions`.**
`acceptEdits` means reads/edits inside allowed paths happen freely, but any
Bash command NOT in `allow` still prompts — this is intentional, it's the
safer default. `bypassPermissions` removes ALL prompts, including the
`deny` list's enforcement (yes, that means `rm -rf` and reading `.env`
stop being blocked too) — only use this in a fully disposable, sandboxed
environment, never on a machine with real credentials or an unbacked-up
working tree. If you're running Jarvis on your actual laptop against your
actual repo, stay on `acceptEdits` and fix problem #1 above instead
(expand `allow`) rather than reaching for `bypassPermissions`.

**Practical diagnosis:** when a prompt appears, read what command it's
asking about. If it's something routine (a test run, a lint check, `git
diff`) — add that exact command pattern to `permissions.allow` in your
`.claude/settings.json` and it won't ask again. If it's something that
actually deserves a human glance (a commit, a force-push, `rm`) — that's
the sandbox working as intended, not a bug to route around.

## Isolated build directories — why prompts still appear for /private/tmp/...

Claude Code sometimes runs a test build in an isolated directory (something
like `/private/tmp/claude-501/-Users-you-project/build-isolated/`) instead
of your actual working tree, specifically to avoid leaving build artifacts
or partial state in your real project if the build fails or gets
interrupted. Each session gets a **fresh, randomly-suffixed path** — the
`claude-501` part and the exact directory name differ every time.

This defeats naive path-based allow-listing: you can't pre-approve
`/private/tmp/claude-501/-Users-you-project/build-isolated/src/**` because
that exact path only exists for one session. The fix isn't to allow-list
every possible path (impossible — new random paths appear every session);
it's to allow-list the **command shape** instead, per Claude Code's
documented Bash wildcard syntax (wildcards match on the command string
itself — prefix, suffix, or infix — not on an arbitrary compound path glob):

```json
"Bash(mkdir -p /private/tmp/claude-*)",
"Bash(cd /private/tmp/claude-*)",
"Bash(cp * /private/tmp/claude-*)"
```

These three cover the routine setup (`mkdir`, `cd`, `cp` copying source
files INTO the isolated build dir) that repeats every time this happens.

**`rm -rf` is deliberately NOT re-allowed for this pattern** — the global
`deny` on `Bash(rm -rf:*)` always wins over any `allow`, by design (deny
beats allow beats ask, unconditionally, per Claude Code's rule evaluation
order). So cleanup of the isolated build directory will still prompt once
per session. That's an accepted tradeoff: broad coverage for the routine
setup commands, one remaining prompt for the one command category
(`rm -rf`) that's dangerous enough to keep gated everywhere, including here.

## Tuning it

Start with the wide `allow` list in the template, tighten only if you find
it's letting through something you don't want automatic for your specific
project:

1. Run a normal `/jarvis:advance` session
2. Note what still prompted that you'd rather auto-approve → add the exact
   command to `allow`
3. Note anything that ran automatically that you wish had asked → move it
   from `allow` to `ask`
4. Within a session or two the prompts settle into "only the things that
   actually matter" — commits, pushes, deletions

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