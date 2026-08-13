# Security Scanner Integration

## Two-level setup

```
Level 1 — security-agent.mjs (regex, deterministic, free)
   ↓ runs on pre-commit hook (husky + lint-staged) and in CI
   ↓ hard-fails commit on critical/high findings

Level 2 — /jarvis:security command (AI contextual, costs tokens)
   ↓ runs on-demand or per-PR
   ↓ writes findings to defects.md → /jarvis:advance fixes them
```

## Why both?

| | Level 1 (regex) | Level 2 (AI) |
|---|---|---|
| Cost | 0 tokens | tokens per run |
| Speed | milliseconds | seconds |
| Catches | known patterns (hardcoded secrets, eval, etc.) | context, data flow, architectural holes |
| Runs on | every commit, CI | per-PR review, on-demand |
| SOC 2 evidence | yes — deterministic, auditable | yes — but document AI involvement |

## Install Level 1

### 1. Copy the scanner

```bash
mkdir -p scripts
cp ~/.claude/skills/jarvis/scripts/security-agent.mjs scripts/
# Or download from your jarvis-final repo
```

### 2. Install husky and lint-staged

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

### 3. Wire pre-commit hook

`.husky/pre-commit`:

```sh
#!/usr/bin/env sh
pnpm exec lint-staged
```

### 4. Configure lint-staged

In `package.json`:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte}": [
      "node scripts/security-agent.mjs --fail-on high --files"
    ]
  }
}
```

lint-staged passes only **staged** file paths (`git add`-ed) into `--files`.
Scanner checks just what you are committing — fast.
On critical/high finding → exit 1 → commit blocked.

### 5. Add full-tree scan script

In `package.json`:

```json
{
  "scripts": {
    "security": "node scripts/security-agent.mjs --fail-on high",
    "security:report": "node scripts/security-agent.mjs --json > security-report.json"
  }
}
```

`pnpm security:report` generates JSON — **store as SOC 2 evidence** (CI artifact).

## Why also CI?

A developer can bypass pre-commit with `git commit --no-verify`.
**Pre-commit = convenience; CI = the real gate.**

For SOC 2 the CI check is what counts.

### GitHub Actions example

```yaml
- name: Security scan
  run: node scripts/security-agent.mjs --fail-on high
```

This turns the PR red and blocks merge on critical/high findings.
That is your auditable control.

## Level 2 usage

Run on-demand:

```
/jarvis:security                    # audit current git diff
/jarvis:security src/auth/          # audit specific path
```

Findings written to `defects.md` → `/jarvis:advance` runs the fix cycle.

## SOC 2 honesty

Storing scan reports does NOT make you SOC 2 compliant.
It produces evidence for ONE control: vulnerability detection in code review.
SOC 2 also needs: access policies, encryption-at-rest, monitoring,
vendor management, incident response, change management process, etc.

Tell the auditor: "this is our evidence of vulnerability detection control."
Not: "we are SOC 2 because the scan passes."

## False-positive suppression

When the scanner is wrong about a specific line, add an inline comment:

```typescript
const apiKey = await fetchFromVault(); // sec-ignore — fetched at runtime, not committed
```

`// sec-ignore` on the same line tells the scanner to skip it.
Always include a justification in the comment for the audit trail.
