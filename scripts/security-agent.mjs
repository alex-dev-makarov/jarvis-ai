#!/usr/bin/env node
/**
 * security-agent.mjs — Level 1 deterministic security scanner
 * ────────────────────────────────────────────────────────────
 * Catches known-pattern vulnerabilities WITHOUT AI (0 tokens, 0 cost).
 * Runs on pre-commit hook and HARD-FAILS (exit 1) on critical/high findings.
 * This is "the control" in SOC 2 terms — auditable, deterministic, fast.
 *
 * Why regex and not AI on pre-commit?
 *   - Fast (milliseconds vs seconds)
 *   - Free (no API calls per commit)
 *   - Deterministic (same input → same output, auditable)
 * AI (Level 2 — security.md skill) is for deep context that regex misses.
 *
 * Usage:
 *   node security-agent.mjs                    # scan whole tree (cwd)
 *   node security-agent.mjs --dir ./src        # specific directory
 *   node security-agent.mjs --files a.ts b.tsx # only these files (husky/lint-staged)
 *   node security-agent.mjs --fail-on critical # threshold (default: high)
 *   node security-agent.mjs --json             # machine output (SOC 2 audit trail)
 *
 * Suppress false-positive in code:
 *   const apiKey = readFromVault(); // sec-ignore  ← this line is skipped
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname, relative } from "node:path";

// ── Config ───────────────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out",
  "coverage", ".turbo", ".cache", "vendor",
]);

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

// ── Rules ────────────────────────────────────────────────────────
// Each rule maps to a SOC 2 Trust Service Criterion (TSC).
//   CC6.x — Logical Access (access, secrets, credentials)
//   CC7.x — System Operations (monitoring, vuln detection)
//   CC8.x — Change Management (pre-commit gate)

const RULES = [
  // ── Secrets & credentials (SOC 2 CC6.1 — most critical) ──
  {
    id: "SEC001",
    name: "Hardcoded secret/credential",
    severity: "critical",
    soc2: "CC6.1",
    re: /\b(api[_-]?key|secret|password|passwd|pwd|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'`]([^"'`]{8,})["'`]/i,
    // Filter out obvious placeholders and env reads
    filter: (m, line) => {
      const value = m[2] ?? "";
      if (/process\.env|import\.meta\.env/.test(line)) return false; // env read — ok
      if (/^(x{3,}|your[_-]|<.+>|changeme|placeholder|example|sample|dummy|fake|test|\$\{|\.{3})/i.test(value)) return false;
      if (/^(.)\1+$/.test(value)) return false; // repeated single char
      return true;
    },
    hint: "Move secret to env variable (process.env / .env, gitignored) or a secrets manager.",
  },
  {
    id: "SEC002",
    name: "AWS access key ID",
    severity: "critical",
    soc2: "CC6.1",
    re: /\bAKIA[0-9A-Z]{16}\b/,
    hint: "Rotate the key in AWS IAM immediately — it is compromised the moment it lands in git.",
  },
  {
    id: "SEC003",
    name: "Private key block",
    severity: "critical",
    soc2: "CC6.1",
    re: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
    hint: "Private keys must never be committed. Move to secrets manager and rotate.",
  },
  {
    id: "SEC004",
    name: "Hardcoded JWT",
    severity: "high",
    soc2: "CC6.1",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    hint: "Hardcoded JWT. If a real token — it is compromised.",
  },

  // ── Next.js: secret leak into client bundle (CC6.1) ──
  {
    id: "SEC010",
    name: "Secret exposed via NEXT_PUBLIC_ prefix",
    severity: "critical",
    soc2: "CC6.1",
    re: /\bNEXT_PUBLIC_[A-Z0-9_]*(SECRET|KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL)/,
    hint: "NEXT_PUBLIC_ is inlined into the client JS bundle — anyone can read it. Remove the prefix; keep server-only.",
  },

  // ── XSS / injection (React, CC6.1/CC7.1) ──
  {
    id: "SEC020",
    name: "dangerouslySetInnerHTML",
    severity: "high",
    soc2: "CC7.1",
    re: /dangerouslySetInnerHTML/,
    hint: "If content is not sanitised (DOMPurify) — this is an XSS vector.",
  },
  {
    id: "SEC021",
    name: "eval() / new Function()",
    severity: "high",
    soc2: "CC7.1",
    re: /\beval\s*\(|\bnew\s+Function\s*\(/,
    hint: "Arbitrary code execution. There is almost always a safer alternative.",
  },
  {
    id: "SEC022",
    name: "Direct innerHTML / document.write",
    severity: "medium",
    soc2: "CC7.1",
    re: /\.innerHTML\s*\+?=|document\.write\s*\(/,
    hint: "Direct HTML injection — XSS risk. Use textContent or sanitise.",
  },
  {
    id: "SEC023",
    name: "Unsafe href (javascript: protocol)",
    severity: "medium",
    soc2: "CC7.1",
    re: /href\s*=\s*["'`]?\s*javascript:/i,
    hint: "javascript:-URL is an XSS vector. Disallow in href.",
  },

  // ── Data leakage / PII logging (CC6.1/CC7.2) ──
  {
    id: "SEC030",
    name: "Sensitive data in console log",
    severity: "medium",
    soc2: "CC7.2",
    re: /console\.(log|debug|info|warn|error)\s*\([^)]*\b(password|passwd|token|secret|api[_-]?key|ssn|credit[_-]?card|cvv|jwt)\b/i,
    hint: "Do not log sensitive data — logs often ship to external systems (SOC 2 audit risk).",
  },
  {
    id: "SEC031",
    name: "Auth token in localStorage/sessionStorage",
    severity: "high",
    soc2: "CC6.1",
    re: /(localStorage|sessionStorage)\.setItem\s*\(\s*["'`][^"'`]*(token|jwt|auth|secret|password|session|refresh)/i,
    hint: "Web Storage is readable by any JS on the page → XSS can steal tokens. Use httpOnly cookies.",
  },

  // ── Network / TLS (CC6.1/CC6.6) ──
  {
    id: "SEC040",
    name: "TLS verification disabled",
    severity: "critical",
    soc2: "CC6.6",
    re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["'`]?0/,
    hint: "Disabled TLS verification → MITM attack vector. Never do this in production.",
  },
  {
    id: "SEC041",
    name: "Insecure HTTP URL",
    severity: "low",
    soc2: "CC6.7",
    re: /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^"'`\s]+/,
    hint: "Unencrypted HTTP. Use HTTPS for external requests.",
  },
  {
    id: "SEC042",
    name: "CORS wildcard origin",
    severity: "medium",
    soc2: "CC6.6",
    re: /Access-Control-Allow-Origin["'`]?\s*[:,]\s*["'`]\*["'`]|origin\s*:\s*["'`]\*["'`]/,
    hint: "CORS '*' allows any origin. Restrict to a whitelist.",
  },

  // ── Crypto (CC6.1/CC6.8) ──
  {
    id: "SEC050",
    name: "Weak crypto (MD5/SHA1)",
    severity: "medium",
    soc2: "CC6.1",
    re: /createHash\s*\(\s*["'`](md5|sha1)["'`]/i,
    hint: "MD5/SHA1 are cryptographically broken. Use SHA-256+ for hashes, bcrypt/argon2 for passwords.",
  },
  {
    id: "SEC051",
    name: "Math.random() for security context",
    severity: "low",
    soc2: "CC6.1",
    re: /\b(token|secret|password|nonce|salt|otp|sessionId)\b[^;\n]*=\s*[^;\n]*Math\.random\s*\(/i,
    hint: "Math.random() is not cryptographically secure. Use crypto.randomUUID() / crypto.getRandomValues().",
  },

  // ── SQL injection (Next.js API routes, CC7.1) ──
  {
    id: "SEC060",
    name: "Possible SQL injection (string interpolation)",
    severity: "high",
    soc2: "CC7.1",
    re: /\b(query|execute|raw)\s*\(\s*`[^`]*\$\{/,
    hint: "Interpolation in SQL → SQL injection. Use parameterised queries ($1, ?).",
  },
];

// ── Argument parsing ─────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dir: process.cwd(), files: null, failOn: "high", json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") args.dir = argv[++i];
    else if (a === "--fail-on") args.failOn = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "--files") {
      args.files = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args.files.push(argv[++i]);
    }
  }
  return args;
}

// ── File collection ──────────────────────────────────────────────

function collectFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) collectFiles(full, acc);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      acc.push(full);
    }
  }
  return acc;
}

// ── Scan a single file ───────────────────────────────────────────

function scanFile(filePath) {
  // Do not scan the scanner itself (it would match its own patterns)
  if (basename(filePath) === "security-agent.mjs") return [];

  let content;
  try { content = readFileSync(filePath, "utf-8"); } catch { return []; }

  const findings = [];
  const lines = content.split("\n");

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    if (/sec-ignore/.test(line)) continue; // false-positive suppression

    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.filter && !rule.filter(m, line)) continue;

      findings.push({
        rule: rule.id,
        name: rule.name,
        severity: rule.severity,
        soc2: rule.soc2,
        file: filePath,
        line: lineNo + 1,
        snippet: line.trim().slice(0, 120),
        hint: rule.hint,
      });
    }
  }
  return findings;
}

// ── Output ───────────────────────────────────────────────────────

const COLORS = {
  critical: "\x1b[41m\x1b[37m",
  high: "\x1b[31m",
  medium: "\x1b[33m",
  low: "\x1b[36m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function printHuman(findings, cwd) {
  if (findings.length === 0) {
    console.log(`${COLORS.bold}\x1b[32m✓ Security scan passed — no issues found.${COLORS.reset}`);
    return;
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  console.log(`\n${COLORS.bold}🛡  Security Scan Report${COLORS.reset}\n`);

  for (const f of findings) {
    const tag = `${COLORS[f.severity]} ${f.severity.toUpperCase()} ${COLORS.reset}`;
    const loc = `${relative(cwd, f.file)}:${f.line}`;
    console.log(`${tag} ${COLORS.bold}${f.rule}${COLORS.reset} ${f.name}  ${COLORS.dim}[SOC2 ${f.soc2}]${COLORS.reset}`);
    console.log(`  ${COLORS.dim}${loc}${COLORS.reset}`);
    console.log(`  ${COLORS.dim}│${COLORS.reset} ${f.snippet}`);
    console.log(`  ${COLORS.dim}→ ${f.hint}${COLORS.reset}\n`);
  }

  const counts = findings.reduce((acc, f) => ((acc[f.severity] = (acc[f.severity] || 0) + 1), acc), {});
  const summary = ["critical", "high", "medium", "low"]
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${s}`)
    .join(", ");
  console.log(`${COLORS.bold}Total: ${findings.length} issue(s) — ${summary}${COLORS.reset}`);
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();

  const files = args.files
    ? args.files.filter((f) => SCAN_EXTENSIONS.has(extname(f)))
    : collectFiles(args.dir);

  const findings = files.flatMap(scanFile);

  if (args.json) {
    // Machine output — this is your audit trail. Store these reports as SOC 2 evidence of control.
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      scanned_files: files.length,
      total_findings: findings.length,
      findings,
    }, null, 2));
  } else {
    printHuman(findings, cwd);
  }

  // Threshold: any rule >= --fail-on → exit 1 (block commit)
  const threshold = SEVERITY_RANK[args.failOn] ?? SEVERITY_RANK.high;
  const blocking = findings.filter((f) => SEVERITY_RANK[f.severity] >= threshold);

  if (blocking.length > 0) {
    if (!args.json) {
      console.log(`\n${COLORS.critical} COMMIT BLOCKED ${COLORS.reset} ${blocking.length} issue(s) at or above "${args.failOn}". Fix or add "// sec-ignore" with justification.`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();
