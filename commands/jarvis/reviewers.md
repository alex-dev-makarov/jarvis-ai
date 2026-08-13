---
description: Quickly test a new/different model for REVIEWER by patching its frontmatter directly. Use to try a just-released model without editing jarvis.toml.
argument-hint: <model alias or full model id> e.g. "opus-5", "claude-opus-5", "sonnet"
allowed-tools: Read, Edit, Bash
---

You are testing a model override for the `jarvis-reviewer` subagent.

> $ARGUMENTS

## Why this needs a real file edit (not just chat context)

Claude Code resolves a subagent's model from the `model:` field in its
frontmatter file **at the moment the subagent is invoked** — not from
anything said earlier in this conversation. A command that only prints
"now using opus-5" without touching the file does **nothing**: the next
`/jarvis:advance` still reads whatever model is on disk.

So this command makes a **real, but clearly temporary**, edit to:

```
~/.claude/agents/jarvis-reviewer.md
```

(or `~/.claude-<project>/agents/jarvis-reviewer.md` depending on which
`CLAUDE_CONFIG_DIR` this session is using — check which one is active and
edit that one)

## Steps

### 1. Resolve the target model

- Bare alias (`opus`, `sonnet`, `haiku`) → use as-is, Claude Code resolves
  the alias to the current model in that family
- A version-specific name (`opus-5`, `claude-opus-5`) → use verbatim; if
  Claude Code does not recognise it, report the exact error back, don't guess
- If `$ARGUMENTS` is empty → ask which model to try

### 2. Back up the current value

Read the current `model:` line from `jarvis-reviewer.md` frontmatter.
Print it — this is what you'll need to restore later:

```
Current model: opus
```

### 3. Patch the frontmatter

Replace the `model:` line with the requested value. Confirm:

```
── Reviewer model override (TEMPORARY) ─────────────
File patched: ~/.claude/agents/jarvis-reviewer.md
Before: model: opus
After:  model: opus-5

This change is ON DISK, not session-only — it persists across Claude Code
restarts until you revert it.

To make this permanent: edit jarvis.toml's [agent_tiers] in the jarvis
repo and re-run ./install.sh — that is the source of truth and will
overwrite this manual patch on the next install.

To revert THIS manual test right now:
  /jarvis:reviewers opus     ← (or whatever the "Before" value was)
─────────────────────────────────────────────────────
```

### 4. Remind about jarvis.toml drift

This patch is invisible to `jarvis.toml` — if someone runs `./install.sh`
later without updating the toml, it will silently overwrite this manual
test back to whatever the toml says. That is correct behaviour (toml is
the source of truth) but worth saying explicitly so the user isn't
surprised.

## Does NOT

- Touch `jarvis.toml` — this is a scratch test, not a config change
- Touch any other agent's frontmatter (`jarvis-executor`, `jarvis-planner`, etc.)
- Persist if you later run `./install.sh` — that re-applies `jarvis.toml`
  and overwrites this manual patch
