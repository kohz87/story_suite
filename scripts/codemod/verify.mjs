// Checks a migrated tree: every relative specifier resolves, nothing sits at an old location, and the diff is only renames plus path edits.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildPlan, trackedFiles } from './plan.mjs';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

/**
 * Verifies the tree at `root` against the rule sets. Returns a list of problem sentences (empty means fine):
 * a relative specifier that resolves to no tracked file, a tracked file still at an old location, and,
 * when `codemap` is set, a failing `node scripts/codemap/cli.mjs --check`.
 */
export function verifyTree(root, ruleSets, { codemap = false } = {}) {
  const files = trackedFiles(root);
  const set = new Set(files);
  const problems = [];
  for (const file of files.filter(name => /\.m?js$/.test(name))) {
    const scan = scanSpecifiers(fs.readFileSync(path.join(root, file), 'utf8'));
    if (scan.error) { problems.push(`${file}: does not parse (${scan.error})`); continue; }
    for (const item of scan.specs) {
      if (item.spec.startsWith('.') && !resolveSpecifier(file, item.spec, set, item.kind === 'url')) problems.push(`${file}:${item.line}: "${item.spec}" resolves to no tracked file`);
    }
  }
  const plan = buildPlan(files, ruleSets);
  for (const move of plan.moves) problems.push(`${move.from} is still at its old location (rule target ${move.to})`);
  for (const file of plan.deletes) problems.push(`${file} should have been deleted`);
  if (codemap) {
    try {
      execFileSync('node', ['scripts/codemap/cli.mjs', '--check'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      problems.push(`codemap check failed: ${String(error.stdout || error.stderr || error.message).trim().split('\n')[0]}`);
    }
  }
  return problems;
}

// A line with every quoted string emptied, so two lines that differ only in a path compare equal.
const flatten = line => line.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '$1$1').trim();

function gitDiff(root, args) {
  return execFileSync('git', ['diff', '--no-color', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
}

/**
 * The J14 review check, in two steps that match the two commits `applyLayout` makes. (1) base -> movesRef: with
 * `-M100%` every entry must be a pure rename (R100) or a delete. (2) movesRef -> head: with renames off, every JS
 * file's changed lines must come in equal-length removed/added runs that differ only inside quoted strings.
 * Returns { problems, dataEdits }; dataEdits counts changed non-JS files (listed, not judged).
 */
export function verifyDiff(root, base, movesRef, head = 'HEAD') {
  const problems = [];
  for (const line of gitDiff(root, ['--name-status', '-M100%', base, movesRef]).split('\n').filter(Boolean)) {
    const [status, ...names] = line.split('\t');
    if (status !== 'R100' && status !== 'D') problems.push(`the move commit is not a pure rename: ${status} ${names.join(' -> ')}`);
  }
  let dataEdits = 0;
  for (const block of gitDiff(root, ['--no-renames', '-U0', movesRef, head]).split(/^diff --git /m).slice(1)) {
    const name = /^\+\+\+ b\/(.+)$/m.exec(block)?.[1] ;
    if (!name) continue;
    if (!/\.m?js$/.test(name)) { dataEdits += 1; continue; }
    const removed = [];
    const added = [];
    const flush = () => {
      if (removed.length !== added.length) problems.push(`${name}: ${removed.length} lines removed but ${added.length} added in one hunk`);
      else removed.forEach((line, i) => { if (flatten(line) !== flatten(added[i])) problems.push(`${name}: content line changed: ${line.trim().slice(0, 80)}`); });
      removed.length = 0; added.length = 0;
    };
    for (const line of block.split('\n')) {
      if (line.startsWith('@@')) flush();
      else if (line.startsWith('-') && !line.startsWith('---')) removed.push(line.slice(1));
      else if (line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
    }
    flush();
  }
  return { problems, dataEdits };
}
