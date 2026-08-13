
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse flags out of the argument list ──────────────────────────
# --sandbox can appear anywhere among the project names.

INSTALL_SANDBOX=false
PROJECTS=()
for arg in "$@"; do
  if [ "$arg" = "--sandbox" ]; then
    INSTALL_SANDBOX=true
  else
    PROJECTS+=("$arg")
  fi
done

# ── Step 1: Apply tier routing from jarvis.toml ───────────────────

if [ -f "$SCRIPT_DIR/jarvis.toml" ]; then
  echo "→ Applying tier routing from jarvis.toml"
  node "$SCRIPT_DIR/scripts/apply-tiers.mjs"
  echo ""
else
  echo "⚠️  jarvis.toml not found — using existing model: values in agents/*.md"
  echo ""
fi

# ── Step 2: Install harness files into ~/.claude[-<project>]/ ─────

install_into() {
  local target_dir="$1"
  echo "→ Installing harness into $target_dir"

  mkdir -p "$target_dir/commands/jarvis"
  mkdir -p "$target_dir/skills/jarvis"
  mkdir -p "$target_dir/agents"

  cp -r "$SCRIPT_DIR/commands/jarvis/." "$target_dir/commands/jarvis/"
  cp -r "$SCRIPT_DIR/skills/jarvis/."   "$target_dir/skills/jarvis/"
  cp -r "$SCRIPT_DIR/agents/."          "$target_dir/agents/"

  echo "  ✓ commands: $(ls "$target_dir/commands/jarvis" | wc -l | tr -d ' ') files"
  echo "  ✓ skills:   $(find "$target_dir/skills/jarvis" -name '*.md' | wc -l | tr -d ' ') files"
  echo "  ✓ agents:   $(find "$target_dir/agents" -name 'jarvis-*.md' | wc -l | tr -d ' ') files"
}

if [ "${#PROJECTS[@]}" -eq 0 ]; then
  install_into "$HOME/.claude"
else
  for project in "${PROJECTS[@]}"; do
    install_into "$HOME/.claude-$project"
  done
fi

# ── Step 3: Create jarvis.context.md in the current project ───────
#
# Only runs if:
#   a) we are inside a git repo (git rev-parse succeeds)
#   b) the file does not already exist (never overwrites)
#
# Why here and not in install_into()?
#   jarvis.context.md belongs to the PROJECT (goes into git),
#   not to ~/.claude/. So we create it in the git repo root,
#   not in the Claude config dir.

PROJECT_ROOT=""
if git rev-parse --show-toplevel &>/dev/null 2>&1; then
  PROJECT_ROOT="$(git rev-parse --show-toplevel)"
fi

if [ -n "$PROJECT_ROOT" ]; then
  CONTEXT_FILE="$PROJECT_ROOT/jarvis.context.md"

  # Rough token estimate: chars / 4. Good enough for a budget warning, not
  # meant to be exact — see AEO article's point that token count itself is
  # a first-class signal, not just a nice-to-have.
  check_context_tokens() {
    local f="$1"
    local chars
    chars=$(wc -c < "$f" | tr -d ' ')
    local tokens=$((chars / 4))
    echo "  ℹ  jarvis.context.md ≈ ${tokens} tokens (this loads into EVERY I1/I2 brief)"
    if [ "$tokens" -gt 2000 ]; then
      echo "  ⚠  Over the 2,000-token budget — this file (plus any @referenced"
      echo "     skills it resolves to) adds real cost to every executor/reviewer"
      echo "     call. Consider trimming, or moving detail into skill files that"
      echo "     are only pulled in when actually relevant."
    fi
  }

  if [ -f "$CONTEXT_FILE" ]; then
    echo ""
    echo "→ jarvis.context.md already exists at $CONTEXT_FILE — skipping (not overwritten)"
    check_context_tokens "$CONTEXT_FILE"
  else
    echo ""
    echo "→ Creating jarvis.context.md at $CONTEXT_FILE"

    # Detect project name from repo root dir name
    PROJECT_NAME="$(basename "$PROJECT_ROOT")"

    cat > "$CONTEXT_FILE" << EOF
# Jarvis Project Context — $PROJECT_NAME
#
# This file is read by the global Jarvis harness at the start of each
# inner-loop session. It provides project-specific rules to global agents
# (jarvis-executor, jarvis-reviewer) without modifying them globally.
#
# Two sections matter:
#   ## Review Rules    → passed to jarvis-reviewer in every I2 brief
#   ## Executor Rules  → passed to jarvis-executor in every I1 brief
#
# TOKEN BUDGET: keep the whole file under ~2,000 tokens (~8,000 characters).
# This loads into every I1/I2 brief — every line here has a real, recurring
# cost. If you reference skill files via @path, their resolved content
# counts toward this budget too.
#
# Delete this comment block once you have filled in your project rules.

## Stack
# Example: Next.js 14 App Router · TypeScript strict · RTK Query · CSS Variables · pnpm
<fill in your stack>

## Review Rules
# Rules the reviewer checks on every PR diff.
# Example entries — replace with your own:
# - RTK Query: providesTags required on every query, invalidatesTags on mutations
# - CSS Variables only — no hardcoded colors (#fff, rgb(), hsl())
# - Server Components by default; use client only when strictly needed
# - Auth tokens: httpOnly cookies only, never localStorage
# - No dangerouslySetInnerHTML without DOMPurify
# - No console.log in production code
<fill in your review rules>

## Executor Rules
# Constraints the executor follows when implementing tasks.
# Example entries — replace with your own:
# - Read max 2 files per step
# - Use grep -n instead of reading whole files
# - Never read: node_modules/, dist/, .next/, pnpm-lock.yaml
# - Co-locate tests: src/components/Foo/__tests__/Foo.test.tsx
<fill in your executor rules>
EOF

    echo "  ✓ Created — edit $CONTEXT_FILE before running /jarvis:advance"
    echo "  ℹ  Add to git: git add jarvis.context.md"
    echo "  ℹ  Or ignore:  echo 'jarvis.context.md' >> .gitignore"
    check_context_tokens "$CONTEXT_FILE"
  fi
else
  echo ""
  echo "  ℹ  Not inside a git repo — skipping jarvis.context.md creation"
  echo "     Run install.sh from inside your project to create it automatically,"
  echo "     or copy jarvis.context.md.example manually."
fi

# ── Step 3.5: Copy research/perf-patterns.md into the project ─────
#
# jarvis-perf reads this file directly from the project (grep-style,
# same as scripts/security-agent.mjs) — it is NOT passed via subagent
# brief the way jarvis.context.md is. So it needs to physically live in
# the project, not just in ~/.claude*/. Never overwrites an existing copy
# — if the user has customized it, their version wins.

if [ -n "$PROJECT_ROOT" ]; then
  RESEARCH_DIR="$PROJECT_ROOT/research"
  PATTERNS_FILE="$RESEARCH_DIR/perf-patterns.md"

  if [ -f "$PATTERNS_FILE" ]; then
    echo ""
    echo "→ research/perf-patterns.md already exists — not overwritten"
  else
    mkdir -p "$RESEARCH_DIR"
    cp "$SCRIPT_DIR/research/perf-patterns.md" "$PATTERNS_FILE"
    echo ""
    echo "→ Copied research/perf-patterns.md into the project (for jarvis-perf)"
    echo "  ℹ  Add to git: git add research/perf-patterns.md"
  fi
fi

# ── Step 4: File-isolation sandbox (macOS) ────────────────────────
#
# By default we only OFFER this — path globs (src/ vs app/ vs lib/) are
# project-specific, and a wrong sandbox blocks legitimate work. Pass
# --sandbox to actually install it; you should still open the resulting
# .claude/settings.json afterward and adjust the Edit/Write globs to match
# your project's real directory layout before trusting it fully.

if [ -n "$PROJECT_ROOT" ]; then
  mkdir -p "$PROJECT_ROOT/.claude"
  SANDBOX_FILE="$PROJECT_ROOT/.claude/settings.json"

  if [ -f "$SANDBOX_FILE" ]; then
    echo ""
    echo "→ .claude/settings.json already exists — sandbox not touched"
    if [ "$INSTALL_SANDBOX" = true ]; then
      echo "  (--sandbox was passed, but an existing settings.json is never"
      echo "   overwritten — merge $SCRIPT_DIR/settings.sandbox.json.example"
      echo "   into it by hand if you want the sandbox rules added)"
    fi
  elif [ "$INSTALL_SANDBOX" = true ]; then
    cp "$SCRIPT_DIR/settings.sandbox.json.example" "$SANDBOX_FILE"
    echo ""
    echo "→ Sandbox installed at $SANDBOX_FILE"
    echo "  ⚠  Check the Edit/Write path globs (currently src/, tests/, docs/,"
    echo "     .jarvis/) match YOUR project's real layout before trusting it —"
    echo "     a wrong glob blocks legitimate writes, not just risky ones."
    echo "  Guide: $SCRIPT_DIR/docs/sandbox-setup.md"
  else
    echo ""
    echo "→ Optional: file-isolation sandbox available (macOS)"
    echo "  Locks agents to src/, tests/, docs/ — blocks reading .env/secrets,"
    echo "  blocks rm -rf/curl/wget. Two layers: permission rules + macOS sandbox."
    echo "  Install now next time:  ./install.sh <project> --sandbox"
    echo "  Or by hand:  cp $SCRIPT_DIR/settings.sandbox.json.example .claude/settings.json"
    echo "  Guide:   $SCRIPT_DIR/docs/sandbox-setup.md"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────

echo ""
echo "Done. Restart Claude Code (exit fully, then run 'claude' again)."
echo ""
echo "Verify inside Claude Code:"
echo "  /help    → 'Custom commands' tab should list /jarvis:*"
echo "  /agents  → 'Library' tab should list jarvis-planner, jarvis-executor,"
echo "             jarvis-reviewer, jarvis-bugfixer, jarvis-explainer,"
echo "             jarvis-security, jarvis-visual-planner, jarvis-perf"
echo ""
echo "The harness writes a per-action timeline to .jarvis/session-log.md"
echo "(view it with /jarvis:status). To keep it out of git:"
echo "  echo '.jarvis/' >> .git/info/exclude"
echo ""
echo "Next: fill in $PROJECT_ROOT/jarvis.context.md, then run /jarvis:advance"
