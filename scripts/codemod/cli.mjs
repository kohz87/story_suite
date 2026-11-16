// Parses the layout tool commands (plan, apply, verify, port-branch) and prints the per-area plan with unmatched files and dead rules.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadRules, matchPath, ruleKey } from './rules.mjs';
import { buildPlan, planProblems } from './plan.mjs';
import { planForArea } from './area.mjs';
import { loadKnownProblems, splitKnown } from './known.mjs';

import { runApply, runPort, runVerify } from './area-commands.mjs';

const AREAS = ['core', 'director', 'legacy-ui', 'packs', 'people', 'rpg', 'scene-inventory', 'shared'];
const DEFAULT_ALLOW = 'docs/merge/layout-nonliteral.txt';
const DEFAULT_KNOWN_APPLY = 'docs/merge/layout-known-apply.txt';
const DEFAULT_RULES_DIR = path.join(import.meta.dirname, 'layout');

/** Reads every `*.rules.json` in `rulesDir`, sorted by area, and refuses a folder that lacks one of the eight areas. */
export function loadLayoutRules(rulesDir = DEFAULT_RULES_DIR) {
  const sets = fs.readdirSync(rulesDir)
    .filter(name => name.endsWith('.rules.json'))
    .sort()
    .map(name => loadRules(path.join(rulesDir, name)));
  const areas = sets.map(set => set.area).sort();
  if (JSON.stringify(areas) !== JSON.stringify([...AREAS].sort())) {
    throw new Error(`layout rule files must cover exactly: ${AREAS.join(', ')} (found: ${areas.join(', ') || 'none'})`);
  }
  return sets;
}

/** Lists tracked files with `git ls-files -z`. A sandbox that reports EPERM after a successful git run still gives stdout. */
export function listTracked(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
    return out.split('\0').filter(Boolean).sort();
  } catch (error) {
    const out = error?.stdout;
    if (error?.code === 'EPERM' && error?.status === 0 && out) {
      const text = Buffer.isBuffer(out) ? out.toString('utf8') : String(out);
      if (text) return text.split('\0').filter(Boolean).sort();
    }
    throw new Error(`git ls-files failed in ${root}: ${error?.message ?? error}`);
  }
}

/** Plans `files` against `ruleSets` and counts the moves and deletes each area owns. No files are touched. */
export function planLayout(files, ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  const plan = buildPlan(files, ruleSets);
  const counts = Object.fromEntries(ruleSets.map(set => [set.area, { moves: 0, deletes: 0 }]));
  if (!plan.duplicates.length) {
    const ownerOf = new Map();
    for (const set of ruleSets) for (const rule of set.rules) ownerOf.set(ruleKey(rule), set.area);
    const areaOf = file => {
      const hit = matchPath(rules, file);
      return hit ? ownerOf.get(ruleKey(hit.rule)) : null;
    };
    for (const move of plan.moves) counts[areaOf(move.from)].moves += 1;
    for (const file of plan.deletes) counts[areaOf(file)].deletes += 1;
  }
  return { files: files.length, counts, plan };
}

function usage(stream) {
  stream.write('usage: node scripts/codemod/cli.mjs plan --area <area> | --all [--root <dir>] [--rules <dir>] [--known <file>]\n'
    + '       node scripts/codemod/cli.mjs apply --area <area> [--dry] [--backup <dir>] [--allow-non-literal <file>] [--known <file>] [--codemap]\n'
    + '       node scripts/codemod/cli.mjs verify --area <area> [--base <ref>] [--moves <ref>] [--rewrites <ref>] [--tip <ref>] [--no-codemap] [--known <file>]\n'
    + '       node scripts/codemod/cli.mjs port-branch <branch> --area <area> [--main <ref>] [--backup <dir>] [--allow-non-literal <file>]\n'
    + '--tip (verify): judge that commit\'s tree, not the working tree. Verify an area at its own tip (its last commit, fix-ups included) once later areas sit on top of it, with --no-codemap.\n'
    + '--allow-non-literal: one path per line (# comments); default docs/merge/layout-nonliteral.txt when it exists. Shrink only.\n'
    + '--codemap (apply): also run the code map check, off by default (a moved tree needs a regenerated map and renames first). verify runs it unless --no-codemap.\n'
    + '--known (apply, verify): lines `stale <file> <value>` and `test <file>`; default docs/merge/layout-known-apply.txt when it exists. Shrink only.\n');
}

function printRows(stream, counts) {
  stream.write('area             moves  deletes\n');
  let moves = 0;
  let deletes = 0;
  for (const area of AREAS) {
    const row = counts[area] ?? { moves: 0, deletes: 0 };
    moves += row.moves;
    deletes += row.deletes;
    stream.write(`${area.padEnd(16)} ${String(row.moves).padStart(5)}  ${String(row.deletes).padStart(7)}\n`);
  }
  stream.write(`${'total'.padEnd(16)} ${String(moves).padStart(5)}  ${String(deletes).padStart(7)}\n`);
}

/** CLI entry point. Returns an exit code; `--all` passes only when every packages file is covered once. */
export async function main(argv = process.argv.slice(2), options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const listFiles = options.listFiles ?? listTracked;
  let command = null;
  let area = null;
  let all = false;
  let root = options.root ?? process.cwd();
  let rulesDir = options.rulesDir ?? DEFAULT_RULES_DIR;
  let knownFile = null;
  let dry = false;
  let backupDir = null;
  let base;
  let mainRef;
  let moves;
  let codemap;
  let rewrites;
  let tip;
  let allowFile = null;
  const given = new Set();
  let branch = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) given.add(arg);
    if (arg === '--area') area = argv[++index];
    else if (arg === '--all') all = true;
    else if (arg === '--root') root = argv[++index];
    else if (arg === '--rules') rulesDir = argv[++index];
    else if (arg === '--known') knownFile = argv[++index];
    else if (arg === '--dry') dry = true;
    else if (arg === '--backup') backupDir = argv[++index];
    else if (arg === '--base') base = argv[++index];
    else if (arg === '--main') mainRef = argv[++index];
    else if (arg === '--codemap') codemap = true;
    else if (arg === '--no-codemap') codemap = false;
    else if (arg === '--moves') moves = argv[++index];
    else if (arg === '--rewrites') rewrites = argv[++index];
    else if (arg === '--tip') tip = argv[++index];
    else if (arg === '--allow-non-literal') allowFile = argv[++index];
    else if (!arg.startsWith('-') && command === 'port-branch' && branch === null) branch = arg;
    else if (!arg.startsWith('-') && command === null) command = arg;
    else {
      stderr.write(`unknown argument: ${arg}\n`);
      usage(stderr);
      return 2;
    }
  }
  const areaCommand = ['apply', 'verify', 'port-branch'].includes(command);
  if (areaCommand ? (!area || all || (command === 'port-branch') !== (branch !== null)) : (command !== 'plan' || Boolean(area) === all)) {
    usage(stderr);
    return 2;
  }
  const accepted = { apply: ['--area', '--root', '--rules', '--dry', '--backup', '--allow-non-literal', '--known', '--codemap'], verify: ['--area', '--root', '--rules', '--base', '--moves', '--rewrites', '--tip', '--no-codemap', '--known'], 'port-branch': ['--area', '--root', '--rules', '--main', '--backup', '--allow-non-literal'], plan: ['--area', '--all', '--root', '--rules', '--known'] }[command];
  const stray = [...given].find(flag => !accepted.includes(flag));
  if (stray) {
    stderr.write(`${stray} does not apply to ${command}\n`);
    usage(stderr);
    return 2;
  }
  if (area && !AREAS.includes(area)) {
    stderr.write(`unknown area: ${area}\n`);
    usage(stderr);
    return 2;
  }
  let ruleSets;
  let listed;
  try {
    ruleSets = loadLayoutRules(rulesDir);
    listed = await listFiles(root);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
  let allowNonLiteral = [];
  if (command === 'apply' || command === 'port-branch') {
    const file = allowFile ?? (fs.existsSync(path.join(root, DEFAULT_ALLOW)) ? path.join(root, DEFAULT_ALLOW) : null);
    try {
      if (file) allowNonLiteral = loadKnownProblems(file);
    } catch (error) {
      stderr.write(`cannot read the non-literal allow-list: ${error.message}\n`);
      return 1;
    }
  }
  let known = [];
  if (command === 'apply' || command === 'verify') {
    const file = knownFile ?? (fs.existsSync(path.join(root, DEFAULT_KNOWN_APPLY)) ? path.join(root, DEFAULT_KNOWN_APPLY) : null);
    try {
      if (file) known = loadKnownProblems(file);
    } catch (error) {
      stderr.write(`cannot read the known list: ${error.message}\n`);
      return 1;
    }
  }
  if (command === 'apply') return runApply(root, ruleSets, area, { dry, backupDir, allowNonLiteral, known, codemap, stdout, stderr });
  if (command === 'verify') return runVerify(root, ruleSets, area, { base, moves, rewrites, tip, codemap, known, stdout, stderr });
  if (command === 'port-branch') return runPort(root, ruleSets, area, branch, { mainRef, backupDir, allowNonLiteral, stdout, stderr });
  const { files, counts, plan: fullPlan } = planLayout(listed, ruleSets);
  const plan = area ? planForArea(listed, ruleSets, area).plan : fullPlan;
  if (area) stdout.write(`${area}: ${counts[area].moves} moves, ${counts[area].deletes} deletes\n`);
  else {
    stdout.write(`tracked files: ${files}\n`);
    printRows(stdout, counts);
  }
  if (plan.unmatched.length) {
    stdout.write(`unmatched (${plan.unmatched.length}):\n`);
    for (const file of plan.unmatched) stdout.write(`  ${file}\n`);
  } else {
    stdout.write('unmatched: none\n');
  }
  if (plan.deadRules.length) {
    stdout.write(`dead rules (${plan.deadRules.length} warning${plan.deadRules.length === 1 ? '' : 's'}):\n`);
    for (const rule of plan.deadRules) stdout.write(`  ${rule.area}: ${rule.from} matches no tracked file\n`);
  } else {
    stdout.write('dead rules: none\n');
  }
  const warnings = [];
  let problems = planProblems(plan, {
    files: new Set(listed),
    readFile: file => fs.readFileSync(path.join(root, file), 'utf8'),
    warnings,
  });
  if (knownFile) {
    let known;
    try {
      known = loadKnownProblems(knownFile);
    } catch (error) {
      stderr.write(`cannot read known problems: ${error.message}\n`);
      return 1;
    }
    const { fresh, seen, stale } = splitKnown(problems, known);
    for (const line of seen) warnings.push(`known problem (listed in ${knownFile}): ${line}`);
    for (const line of stale) warnings.push(`stale known-problem line, remove it: ${line}`);
    problems = fresh;
  }
  if (warnings.length) {
    stdout.write(`plan warnings (${warnings.length} warning${warnings.length === 1 ? '' : 's'}):\n`);
    for (const warning of warnings) stdout.write(`  ${warning}\n`);
  }
  if (problems.length) {
    stderr.write(`plan problems (${problems.length}):\n`);
    for (const problem of problems) stderr.write(`  ${problem}\n`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exitCode = await main();
}
