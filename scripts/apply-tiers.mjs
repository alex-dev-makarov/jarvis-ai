#!/usr/bin/env node
/**
 * apply-tiers.mjs — reads jarvis.toml, writes the resolved model into
 * each agents/jarvis-*.md frontmatter.
 *
 * Changes vs previous version:
 *   - Parses [pipeline.*] sections (read-only — used only for output annotation)
 *   - Annotates conditional agents in the output table
 *   - visual tier / jarvis-visual-planner handled same as any other agent
 *
 * IMPORTANT: this script is install-time only. It writes static model:
 * values into frontmatter. Runtime routing (detect image → invoke
 * visual-planner) lives in skills/jarvis/loop/inner-loop.md.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const TOML_PATH = join(REPO_ROOT, "jarvis.toml");
const AGENTS_DIR = join(REPO_ROOT, "agents");

// ── TOML parser ───────────────────────────────────────────────────
// Supports: [section], [section.subsection], key = "value", # comments
// Does NOT support: arrays, multi-line strings, numbers, booleans

function parseSimpleToml(raw) {
  const sections = {};
  let current = null;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    // Matches [section] and [section.subsection]
    const sectionMatch = line.match(/^\[([\w.\-]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1];
      sections[current] = {};
      continue;
    }

    const kvMatch = line.match(/^([\w.\-]+)\s*=\s*"([^"]*)"$/);
    if (kvMatch && current) {
      sections[current][kvMatch[1]] = kvMatch[2];
    }

    // Also handle unquoted integers (e.g. max_plan_tokens = 600)
    const kvIntMatch = line.match(/^([\w.\-]+)\s*=\s*(\d+)$/);
    if (kvIntMatch && current) {
      sections[current][kvIntMatch[1]] = parseInt(kvIntMatch[2], 10);
    }
  }

  return sections;
}

// ── Load config ───────────────────────────────────────────────────

if (!existsSync(TOML_PATH)) {
  console.error(`❌ jarvis.toml not found at ${TOML_PATH}`);
  process.exit(1);
}

const raw = readFileSync(TOML_PATH, "utf-8");
const config = parseSimpleToml(raw);

const tiers = config.tiers ?? {};
const agentTiers = config.agent_tiers ?? {};

// Collect pipeline sections (pipeline.*) for annotation
// These are read-only here — actual runtime routing is in inner-loop.md
const pipelines = {};
for (const [key, val] of Object.entries(config)) {
  if (key.startsWith("pipeline.")) {
    const pipelineName = key.replace("pipeline.", "");
    pipelines[pipelineName] = val;
  }
}

// Build set of conditional agents (invoked only when pipeline triggers)
// so we can annotate them in the output table
const conditionalAgents = new Set();
for (const pipeline of Object.values(pipelines)) {
  if (pipeline.visual_planner_agent) {
    conditionalAgents.add(pipeline.visual_planner_agent);
  }
}

if (Object.keys(tiers).length === 0) {
  console.error("❌ [tiers] section empty or missing in jarvis.toml");
  process.exit(1);
}
if (Object.keys(agentTiers).length === 0) {
  console.error("❌ [agent_tiers] section empty or missing in jarvis.toml");
  process.exit(1);
}

// ── Apply to each agent file ──────────────────────────────────────

const rows = [];
let hadError = false;

for (const [agentName, tierName] of Object.entries(agentTiers)) {
  const model = tiers[tierName];
  const agentPath = join(AGENTS_DIR, `${agentName}.md`);

  if (!model) {
    console.error(`❌ ${agentName}: tier "${tierName}" not defined in [tiers]`);
    hadError = true;
    continue;
  }

  if (!existsSync(agentPath)) {
    console.error(`❌ ${agentName}: file not found at ${agentPath}`);
    hadError = true;
    continue;
  }

  const content = readFileSync(agentPath, "utf-8");

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    console.error(`❌ ${agentName}: no YAML frontmatter found`);
    hadError = true;
    continue;
  }

  const oldFrontmatter = frontmatterMatch[1];
  if (!/^model:\s*\S+$/m.test(oldFrontmatter)) {
    console.error(`❌ ${agentName}: no "model:" line in frontmatter`);
    hadError = true;
    continue;
  }

  const oldModelMatch = oldFrontmatter.match(/^model:\s*(\S+)$/m);
  const oldModel = oldModelMatch ? oldModelMatch[1] : "?";

  const newFrontmatter = oldFrontmatter.replace(
    /^model:\s*\S+$/m,
    `model: ${model}`
  );
  const newContent = content.replace(oldFrontmatter, newFrontmatter);

  writeFileSync(agentPath, newContent, "utf-8");

  rows.push({
    agentName,
    tierName,
    oldModel,
    model,
    conditional: conditionalAgents.has(agentName),
  });
}

// ── Report ────────────────────────────────────────────────────────
//
// Bare aliases Claude Code resolves itself: haiku, sonnet, opus, fable
// (plus any future short names Anthropic adds). Anything else — e.g.
// "claude-sonnet-4-6" — is a pinned version string, flagged below so it's
// visible at a glance which tiers are pinned vs floating with the alias.

const KNOWN_ALIASES = new Set(["haiku", "sonnet", "opus", "fable"]);

console.log("\n┌─ Jarvis tier routing applied ─────────────────────────────────┐");
for (const r of rows) {
  const changed  = r.oldModel !== r.model ? "  ←changed" : "";
  const flag     = r.conditional ? " [conditional]" : "";
  const pinned   = !KNOWN_ALIASES.has(r.model) ? " [pinned]" : "";
  const line = `│  ${r.agentName.padEnd(22)} ${r.tierName.padEnd(9)} → ${r.model.padEnd(20)}${pinned}${flag}${changed}`;
  console.log(line);
}
console.log("└────────────────────────────────────────────────────────────────┘\n");

// Show pipeline summary if any pipelines defined
if (Object.keys(pipelines).length > 0) {
  console.log("Pipelines (runtime-routed, not install-time):");
  for (const [name, cfg] of Object.entries(pipelines)) {
    console.log(`  ${name}:`);
    console.log(`    trigger:        ${cfg.trigger ?? "—"}`);
    console.log(`    visual-planner: ${cfg.visual_planner_agent ?? "—"} (max ${cfg.max_plan_tokens ?? "?"} output tokens)`);
    console.log(`    executor:       ${cfg.executor_agent ?? "—"}`);
    console.log(`    reviewer:       ${cfg.reviewer_agent ?? "—"} (receives screenshot+code for fidelity)`);
  }
  console.log();
}

if (hadError) {
  console.error("⚠️  Completed with errors — see above. Some agents were not updated.");
  process.exit(1);
}

console.log(`✅ ${rows.length} agent(s) updated from jarvis.toml`);
