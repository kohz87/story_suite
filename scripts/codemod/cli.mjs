// Plans every B3 layout area from the rule files: prints per-area move/delete counts and the unmatched list.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadRules, matchPath, ruleKey } from './rules.mjs';
import { buildPlan, planProblems } from './plan.mjs';

const AREAS = ['core', 'director', 'legacy-ui', 'packs', 'people', 'rpg', 'scene-inventory', 'shared'];
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
  stream.write('usage: node scripts/codemod/cli.mjs plan --area <area> | --all [--root <dir>] [--rules <dir>]\n');
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
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--area') area = argv[++index];
    else if (arg === '--all') all = true;
    else if (arg === '--root') root = argv[++index];
    else if (arg === '--rules') rulesDir = argv[++index];
    else if (!arg.startsWith('-') && command === null) command = arg;
    else {
      stderr.write(`unknown argument: ${arg}\n`);
      usage(stderr);
      return 2;
    }
  }
  if (command !== 'plan' || (Boolean(area) === all)) {
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
  const { files, counts, plan } = planLayout(listed, ruleSets);
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
  const problems = planProblems(plan);
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
