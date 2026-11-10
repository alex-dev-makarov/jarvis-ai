#!/usr/bin/env node
// jarvis.mjs — deterministic bookkeeping for the Jarvis loop.
//
// Same idea as Code Mode / code-execution-with-MCP: instead of the model
// spending tool calls (and context) reading whole ledger files, chaining
// sed/grep, and wading through tsc/eslint/jest noise, it runs ONE command
// and gets a compact answer. Judgment stays with the model; parsing,
// counting and bookkeeping live here, where they can't drift.
//
//   ctx                                     branch, paths, predicates, next task
//   set   <PR> <planned|wip|done|blocked>   [--branch <slug>]
//   round <PR> <go-ahead|revise|abstain> [major|minor] [--branch <slug>]
//   check [typecheck] [lint] [test] [--files a.ts b.ts]
//   overview                                every branch's ledger, one table
//   migrate                                 move legacy docs/{tasks,defects,questions,session-log}.md
//                                           into this branch's ledger dir (never overwrites)
//
// Zero dependencies. Runs only git and this repo's own package.json
// scripts (plus eslint on files you name) — no arbitrary command passthrough.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const run = (cmd, args) =>
  spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000 });
const git = (...args) => {
  const r = run('git', args);
  return r.status === 0 ? r.stdout.trim() : null;
};
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const out = (s) => process.stdout.write(s + '\n');
const die = (msg, code = 2) => { out(msg); process.exit(code); };

const slugify = (b) => b.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ── branch + ledger location (ledger-location.md, executed) ───────────
function resolve() {
  const top = git('rev-parse', '--show-toplevel');
  if (!top) return { git: false, dir: 'docs' };
  process.chdir(top);
  // symbolic-ref works on a fresh repo with no commits yet (unborn branch);
  // rev-parse is the fallback that returns 'HEAD' when detached
  const branch = git('symbolic-ref', '--short', '-q', 'HEAD') ?? git('rev-parse', '--abbrev-ref', 'HEAD');
  if (!branch || branch === 'HEAD') die('DETACHED_HEAD — finish the rebase/bisect or check out a named branch before touching the ledger.');
  const slug = slugify(branch);
  const root = fs.existsSync('.jarvis-ledger') ? '.jarvis-ledger' : 'docs/jarvis';
  return { git: true, branch, slug, root, dir: path.join(root, slug) };
}

// positional args = everything before the first --flag
const positional = (args) => { const i = args.findIndex((a) => a.startsWith('--')); return i < 0 ? args : args.slice(0, i); };

function guardBranch(c, args) {
  const i = args.indexOf('--branch');
  if (i < 0) return;
  const expected = args[i + 1];
  if (c.git && expected && expected !== c.slug) {
    die(`BRANCH_CHANGED — expected ${expected}, now on ${c.slug}. Nothing written. Ask the user which ledger to continue on.`, 3);
  }
}

// ── markdown table parsing ─────────────────────────────────────────────
const splitRaw = (line) => line.split(/(?<!\\)\|/);
const cellsOf = (line) => splitRaw(line).slice(1, -1).map((c) => c.trim());
const isSep = (line) => /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(line || '');

function parseTables(text) {
  const lines = text.split('\n');
  const tables = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim().startsWith('|') && isSep(lines[i + 1])) {
      const header = cellsOf(lines[i]).map((h) => h.toLowerCase().replace(/\*/g, ''));
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push({ line: j, cells: cellsOf(lines[j]) });
        j++;
      }
      tables.push({ headerLine: i, header, rows });
      i = j - 1;
    }
  }
  return { lines, tables };
}

const MARK = { planned: '[ ]', wip: '[~]', done: '[x]', blocked: '[!]' };
function normStatus(s) {
  const v = (s || '').toLowerCase().replace(/\*/g, '').trim();
  if (/\[x\]|^done|✓/.test(v)) return 'done';
  if (/\[~\]|wip|progress/.test(v)) return 'wip';
  if (/\[!\]|block/.test(v)) return 'blocked';
  if (/\[ \]|planned|todo|^$/.test(v)) return 'planned';
  return v;
}

// PR rows = rows of tables that have both a PR column and a Status column
// (the Completed table has no Status column, so it's never double-counted).
function prRows(parsed) {
  const res = [];
  for (const t of parsed.tables) {
    const si = t.header.indexOf('status');
    if (si < 0 || !/^pr/.test(t.header[0])) continue;
    for (const r of t.rows) {
      const id = (r.cells[0] || '').replace(/\*/g, '').trim();
      if (!/^PR-[\w.-]+$/i.test(id)) continue;
      const col = (name) => { const k = t.header.indexOf(name); return k < 0 ? '' : (r.cells[k] || ''); };
      res.push({ id, status: normStatus(r.cells[si]), table: t, row: r, col });
    }
  }
  return res;
}

function countTableStatus(parsed, value) {
  let n = 0;
  for (const t of parsed.tables) {
    const si = t.header.indexOf('status');
    if (si < 0) continue;
    n += t.rows.filter((r) => (r.cells[si] || '').toLowerCase() === value).length;
  }
  return n;
}

function ledgerCounts(dir) {
  const tasks = read(path.join(dir, 'tasks.md'));
  const defects = read(path.join(dir, 'defects.md')) || '';
  const qtext = read(path.join(dir, 'questions.md')) || '';
  const prs = tasks ? prRows(parseTables(tasks)) : [];
  const n = (s) => prs.filter((p) => p.status === s).length;
  return {
    exists: tasks !== null,
    prs,
    planned: n('planned'), wip: n('wip'), done: n('done'), blocked: n('blocked'),
    open: (defects.match(/^\*\*Status:\*\*\s*open/gim) || []).length,
    dwip: (defects.match(/^\*\*Status:\*\*\s*wip/gim) || []).length,
    asked: countTableStatus(parseTables(qtext), 'asked')
      + (qtext.match(/^\*\*Status:\*\*\s*asked/gim) || []).length,
  };
}

// ── ctx ────────────────────────────────────────────────────────────────
function cmdCtx() {
  const c = resolve();
  const k = ledgerCounts(c.dir);
  if (c.git) {
    out(`branch: ${c.branch}`);
    out(`slug:   ${c.slug}   (pass --branch ${c.slug} on every write)`);
  } else {
    out('branch: (not a git repo — unscoped legacy paths)');
  }
  out(`ledger: ${c.dir}/${k.exists ? '' : '   (no tasks.md yet — empty ledger, P-plan true)'}`);
  if (c.git && fs.existsSync('docs/tasks.md')) {
    out(k.exists
      ? 'legacy: docs/tasks.md exists unscoped alongside a branch ledger — ignore it; do not read it'
      : 'legacy: docs/tasks.md exists unscoped — run `jarvis.mjs migrate` to move it into this branch ledger, then re-run ctx');
  }
  out(`tasks:  planned ${k.planned} | wip ${k.wip} | done ${k.done} | blocked ${k.blocked}`);
  out(`defects: open ${k.open} | wip ${k.dwip}     questions: asked ${k.asked}`);
  const pPlan = !k.exists || k.prs.length === 0;
  const pExec = k.planned + k.wip > 0;
  const pRev = k.open > 0;
  out(`P-plan ${pPlan}   P-execute ${pExec}   P-review ${pRev}${!pPlan && !pExec && !pRev ? '   → DRAINED' : ''}`);

  const done = new Set(k.prs.filter((p) => p.status === 'done').map((p) => p.id.toUpperCase()));
  const depsOk = (p) => (p.col('dependson') || '').split(/[,\s]+/).filter((d) => /^PR-/i.test(d))
    .every((d) => done.has(d.toUpperCase()));
  const next = k.prs.find((p) => p.status === 'wip')
    || k.prs.find((p) => p.status === 'planned' && depsOk(p));
  if (next) {
    out(`next:   ${next.id} ${MARK[next.status] || next.status}${next.col('rounds') ? `  (rounds ${next.col('rounds')})` : ''}`);
    for (const f of ['problem', 'file', 'fix', 'dependson']) {
      const v = next.col(f);
      if (v) out(`  ${f}: ${v}`);
    }
  } else if (k.planned > 0) {
    out('next:   none runnable — every planned PR waits on an unfinished dependsOn');
  }
}

// ── set ────────────────────────────────────────────────────────────────
function cmdSet(args) {
  const [id, status] = positional(args);
  if (!id || !MARK[status]) die('usage: set <PR> <planned|wip|done|blocked> [--branch <slug>]');
  const c = resolve();
  guardBranch(c, args);
  const file = path.join(c.dir, 'tasks.md');
  const text = read(file) || die(`NO_LEDGER — ${file} does not exist`);
  const parsed = parseTables(text);
  const hit = prRows(parsed).find((p) => p.id.toUpperCase() === id.toUpperCase());
  if (!hit) die(`NOT_FOUND — ${id} in ${file}`, 1);
  const si = hit.table.header.indexOf('status');
  const raw = splitRaw(parsed.lines[hit.row.line]);
  raw[si + 1] = ` ${MARK[status]} `;
  parsed.lines[hit.row.line] = raw.join('|');
  fs.writeFileSync(file, parsed.lines.join('\n'));
  out(`${hit.id}: ${MARK[hit.status] || hit.status} → ${MARK[status]}   (${file})`);
}

// ── round (inner-loop "Round tracking", executed) ──────────────────────
function cmdRound(args) {
  const [id, verdict, sev] = positional(args);
  if (!id || !['go-ahead', 'revise', 'abstain'].includes(verdict)) {
    die('usage: round <PR> <go-ahead|revise|abstain> [major|minor] [--branch <slug>]');
  }
  const c = resolve();
  guardBranch(c, args);
  const file = path.join(c.dir, 'tasks.md');
  const text = read(file) || die(`NO_LEDGER — ${file} does not exist`);
  let parsed = parseTables(text);
  let hit = prRows(parsed).find((p) => p.id.toUpperCase() === id.toUpperCase());
  if (!hit) die(`NOT_FOUND — ${id} in ${file}`, 1);

  let ri = hit.table.header.indexOf('rounds');
  if (ri < 0 && verdict === 'go-ahead') {
    out(`${hit.id} round 1: go-ahead → CLOSE (I5)`);
    return;
  }
  if (ri < 0) {
    // first revise on this PR: add the Rounds column to this table only
    const t = hit.table;
    const L = parsed.lines;
    L[t.headerLine] = L[t.headerLine].replace(/\|\s*$/, '| Rounds |');
    L[t.headerLine + 1] = L[t.headerLine + 1].replace(/\|\s*$/, '|---|');
    for (const r of t.rows) L[r.line] = L[r.line].replace(/\|\s*$/, '|  |');
    parsed = parseTables(L.join('\n'));
    hit = prRows(parsed).find((p) => p.id.toUpperCase() === id.toUpperCase());
    ri = hit.table.header.indexOf('rounds');
  }
  const raw = splitRaw(parsed.lines[hit.row.line]);
  const n = (parseInt(raw[ri + 1], 10) || 0) + 1;
  raw[ri + 1] = ` ${n} `;
  parsed.lines[hit.row.line] = raw.join('|');
  fs.writeFileSync(file, parsed.lines.join('\n'));

  let decision;
  if (verdict === 'go-ahead') decision = 'CLOSE (I5)';
  else if (n >= 5) decision = 'ESCALATE (I6) — round 5, any revise';
  else if (n >= 4 && sev === 'major') decision = 'ESCALATE (I6) — round 4 with major findings';
  else if (verdict === 'abstain') decision = 'REPEAT_REVIEW (I2) — abstention counts as a round';
  else decision = 'FIX (I3/I4)';
  out(`${hit.id} round ${n}: ${verdict}${sev ? '/' + sev : ''} → ${decision}`);
}

// ── check ──────────────────────────────────────────────────────────────
const NOISE = /^\s*$|^\s*(npm (warn|notice)|> |\$ |Done in|yarn run v|warning .*engine)|EBADDEVENGINES|devEngines|^\s+(current|required): \{/i;
const SIGNAL = /error|✕|●|failed|FAIL|TS\d{4}|problem/i;

function cmdCheck(args) {
  const c = resolve();
  const fi = args.indexOf('--files');
  const files = fi < 0 ? [] : args.slice(fi + 1);
  const wanted = (fi < 0 ? args : args.slice(0, fi)).filter((a) => ['typecheck', 'lint', 'test'].includes(a));
  const steps = wanted.length ? wanted : ['typecheck', 'lint', 'test'];

  const top = process.cwd();
  for (const f of files) {
    const abs = path.resolve(f);
    if (!abs.startsWith(top + path.sep) || !fs.existsSync(abs)) die(`BAD_FILE — ${f} (must exist inside the repo)`);
  }
  const pkg = JSON.parse(read('package.json') || die('NO_PACKAGE_JSON'));
  const scripts = pkg.scripts || {};
  const pm = fs.existsSync('pnpm-lock.yaml') ? 'pnpm' : fs.existsSync('yarn.lock') ? 'yarn' : 'npm';
  const pick = (...names) => names.find((n) => scripts[n]);

  const plan = [];
  if (steps.includes('typecheck')) {
    const s = pick('type-check', 'typecheck', 'tsc', 'check-types');
    plan.push(s ? ['typecheck', pm, ['run', s]] : ['typecheck', null, 'no typecheck script in package.json']);
  }
  if (steps.includes('lint')) {
    const lintable = files.filter((f) => /\.(m?[jt]sx?|cjs)$/.test(f));
    if (lintable.length) plan.push(['lint', 'npx', ['eslint', ...lintable]]);
    else { const s = pick('lint'); plan.push(s ? ['lint', pm, ['run', s]] : ['lint', null, 'no lint script']); }
  }
  if (steps.includes('test')) {
    const s = pick('test');
    const dirs = [...new Set(files.map((f) => path.dirname(f)))];
    plan.push(s ? ['test', pm, ['run', s, ...(dirs.length ? ['--', ...dirs] : [])]] : ['test', null, 'no test script']);
  }

  let failed = 0;
  for (const [name, cmd, a] of plan) {
    if (!cmd) { out(`– ${name}: skipped (${a})`); continue; }
    const r = run(cmd, a);
    const lines = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').filter((l) => !NOISE.test(l));
    if (r.status === 0) { out(`✓ ${name}`); continue; }
    if (name === 'test' && lines.some((l) => /No tests found/i.test(l))) { out(`– test: no tests matched ${files.length ? 'the given files' : 'anything'}`); continue; }
    failed++;
    const ts = lines.filter((l) => /error TS\d+/.test(l)).length;
    const sig = lines.filter((l) => SIGNAL.test(l));
    const show = (sig.length ? sig : lines).slice(0, 20);
    out(`✗ ${name}${ts ? ` (${ts} TS errors)` : ''} — ${cmd} ${a.join(' ')}`);
    for (const l of show) out('  ' + l.trimEnd().slice(0, 220));
    if ((sig.length || lines.length) > 20) out(`  … ${(sig.length || lines.length) - 20} more`);
  }
  process.exit(failed ? 1 : 0);
}

// ── overview ───────────────────────────────────────────────────────────
function cmdOverview() {
  const c = resolve();
  if (!c.git) die('not a git repo — no branches to compare');
  if (!fs.existsSync(c.root)) die(`no ledger yet (${c.root}/ missing)`);
  const heads = (git('for-each-ref', '--format=%(refname:short)', 'refs/heads') || '').split('\n').filter(Boolean);
  const live = new Set(heads.map(slugify));
  const rows = fs.readdirSync(c.root, { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, ...ledgerCounts(path.join(c.root, d.name)) }))
    .sort((a, b) => b.wip - a.wip || b.planned - a.planned || a.slug.localeCompare(b.slug));

  const w = Math.max(10, ...rows.map((r) => r.slug.length + (r.slug === c.slug ? 10 : 0)));
  const head = `${'Branch'.padEnd(w)}  Planned  WIP  Done  Defects  Questions`;
  out('── All branches ' + '─'.repeat(Math.max(0, head.length - 16)));
  out(head);
  for (const r of rows) {
    const name = r.slug + (r.slug === c.slug ? '  ←current' : '');
    out(`${name.padEnd(w)}  ${String(r.planned).padStart(7)}  ${String(r.wip).padStart(3)}  ${String(r.done).padStart(4)}  ${String(r.open).padStart(7)}  ${String(r.asked).padStart(9)}`);
  }
  out('─'.repeat(head.length));
  for (const r of rows) {
    const bits = [];
    if (r.open) bits.push(`${r.open} open defect${r.open > 1 ? 's' : ''}`);
    if (r.wip) bits.push(`${r.wip} task${r.wip > 1 ? 's' : ''} [~] mid-flight`);
    if (r.asked) bits.push(`${r.asked} unanswered question${r.asked > 1 ? 's' : ''}`);
    if (bits.length) out(`⚠ ${r.slug} — ${bits.join(', ')}`);
    if (!live.has(r.slug)) out(`ℹ ${c.root}/${r.slug}/ — branch no longer exists, ledger orphaned`);
  }
  const shipped = ((read('docs/completed-log.md') || '').match(/^## PR/gm) || []).length;
  out(`Shipped across all branches: ${shipped} PRs (docs/completed-log.md)`);
}

// ── main ───────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
function cmdMigrate() {
  const c = resolve();
  if (!c.git) die('not a git repo — nothing to migrate');
  const dest = path.join(c.dir, 'tasks.md');
  if (fs.existsSync(dest)) {
    if (fs.readFileSync(dest, 'utf8').trim() !== '') die(`${dest} already has content — refusing to overwrite; resolve manually`);
    fs.rmSync(dest); // empty placeholder — safe to replace
  }
  if (!fs.existsSync('docs/tasks.md')) die('no legacy docs/tasks.md — nothing to migrate');
  fs.mkdirSync(c.dir, { recursive: true });
  for (const f of ['tasks.md', 'defects.md', 'questions.md', 'session-log.md']) {
    const from = path.join('docs', f), to = path.join(c.dir, f);
    if (fs.existsSync(from) && !fs.existsSync(to)) { fs.renameSync(from, to); out(`moved ${from} -> ${to}`); }
  }
  out('done — run ctx again');
}

const table = { migrate: cmdMigrate, ctx: cmdCtx, set: () => cmdSet(args), round: () => cmdRound(args), check: () => cmdCheck(args), overview: cmdOverview };
if (!table[cmd]) {
  die('usage: jarvis.mjs <ctx | set | round | check | overview | migrate>  — see header comment');
}
table[cmd]();
