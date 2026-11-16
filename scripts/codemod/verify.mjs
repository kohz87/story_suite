// Checks a migrated tree: every relative specifier resolves, nothing sits at an old location, and the diff is only renames plus path edits.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildPlan, makeMapper, trackedFiles } from './plan.mjs';
import { rewriteStrings } from './rewrite-strings.mjs';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

/**
 * Verifies the tree at `root` against the rule sets. Returns a list of problem sentences (empty means fine):
 * a relative specifier that resolves to no tracked file, a tracked file still at an old location, a file left in
 * a folder the rules move away that no rule covers, and,
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
  for (const file of plan.unmatched) problems.push(`${file} is still in a folder the rules cover and no rule moves it`);
  for (const item of plan.duplicates) problems.push(`rule "${item.key}" is given by more than one rule file (${item.areas.join(', ')})`);
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
const QUOTED = /(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g;
const flatten = line => line.replace(QUOTED, '$1$1').trim();
const quotedValues = line => [...line.matchAll(QUOTED)].map(match => match[2]);

// The files in a commit, from `git ls-tree`.
const filesAt = (root, ref) => new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', ref], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean));

// Splits "tests/v2/**" or "./a/" into the path part and the tail that is kept as written.
function pathPart(value) {
  const stop = value.search(/\*/);
  const head = stop < 0 ? value : value.slice(0, stop);
  const bare = head.replace(/\.+$/, '').replace(/\/$/, '');
  return { bare, tail: value.slice(bare.length) };
}

// True when a changed string value is a path the mapper produced: the new one is the old one's new place.
function isMappedPath(oldValue, newValue, oldFile, newFile, ctx) {
  if (/^\.{1,2}\/?$/.test(oldValue) || /^\.{1,2}\/?$/.test(newValue)) return false;
  const relative = value => /^\.{1,2}(\/|$)/.test(value);
  if (relative(oldValue) !== relative(newValue)) return false;
  if (relative(oldValue)) {
    const from = resolveSpecifier(oldFile, oldValue, ctx.baseSet, true);
    const to = resolveSpecifier(newFile, newValue, ctx.headSet, true);
    if (from && to && ctx.mapper.map(from.target) === to.target) return true;
  }
  const a = pathPart(oldValue);
  const b = pathPart(newValue);
  if (a.tail !== b.tail || !a.bare || !b.bare) return false;
  const abs = relative(oldValue) ? path.posix.normalize(path.posix.join(path.posix.dirname(oldFile), a.bare)) : a.bare;
  const target = relative(newValue) ? path.posix.normalize(path.posix.join(path.posix.dirname(newFile), b.bare)) : b.bare;
  return ctx.mapper.map(abs) === target;
}

function gitDiff(root, args) {
  return execFileSync('git', ['diff', '--no-color', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
}

/**
 * The J14 review check, in two steps that match the two commits `applyLayout` makes. (1) base -> movesRef: with
 * `-M100%` every entry must be a pure rename (R100) or a delete. (2) movesRef -> head: with renames off, every JS
 * file's changed lines must come in equal-length removed/added runs that differ only inside quoted strings, and
 * each changed string value must be a path the rule sets' mapper produced (the old value's new place, for a
 * relative value read from the file's old and new folders), so `'x'` -> `'y'` is reported.
 * A bare `.`/`..` value is never a mapped path. A JS file deleted in step 2 is a problem unless the plan deletes it.
 * Step 3 reads every package JS file of `base` and lists a package-relative string that would go stale.
 * Returns { problems, dataEdits }; dataEdits counts changed non-JS files and deleted files (listed, not judged).
 */
export function verifyDiff(root, base, movesRef, head = 'HEAD', ruleSets = []) {
  const problems = [];
  const newToOld = new Map();
  for (const line of gitDiff(root, ['--name-status', '-M100%', base, movesRef]).split('\n').filter(Boolean)) {
    const [status, ...names] = line.split('\t');
    if (status !== 'R100' && status !== 'D') problems.push(`the move commit is not a pure rename: ${status} ${names.join(' -> ')}`);
    if (status === 'R100') newToOld.set(names[1], names[0]);
  }
  const baseSet = filesAt(root, base);
  const plan = buildPlan([...baseSet].sort(), ruleSets);
  const ctx = { baseSet, headSet: filesAt(root, head), mapper: makeMapper(plan, ruleSets) };
  const planned = new Set(plan.deletes);
  let dataEdits = 0;
  for (const block of gitDiff(root, ['--no-renames', '-U0', movesRef, head]).split(/^diff --git /m).slice(1)) {
    const gone = /^\+\+\+ \/dev\/null$/m.test(block) ? /^--- a\/(.+)$/m.exec(block)?.[1] : null;
    if (gone) {
      dataEdits += 1;
      if (!planned.has(gone)) problems.push(`${gone}: deleted in the rewrite commit, but the plan does not delete it`);
      continue;
    }
    const name = /^\+\+\+ b\/(.+)$/m.exec(block)?.[1];
    if (!name) continue;
    if (!/\.m?js$/.test(name)) { dataEdits += 1; continue; }
    const removed = [];
    const added = [];
    const flush = () => {
      if (removed.length !== added.length) problems.push(`${name}: ${removed.length} lines removed but ${added.length} added in one hunk`);
      else removed.forEach((line, i) => {
        if (flatten(line) !== flatten(added[i])) { problems.push(`${name}: content line changed: ${line.trim().slice(0, 80)}`); return; }
        const was = quotedValues(line);
        const now = quotedValues(added[i]);
        was.forEach((value, k) => {
          if (value !== now[k] && !isMappedPath(value, now[k], newToOld.get(name) ?? name, name, ctx)) problems.push(`${name}: string "${value}" became "${now[k]}", which is not a mapped path`);
        });
      });
      removed.length = 0; added.length = 0;
    };
    for (const line of block.split('\n')) {
      if (line.startsWith('@@')) flush();
      else if (line.startsWith('-') && !line.startsWith('---')) removed.push(line.slice(1));
      else if (line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
    }
    flush();
  }
  for (const file of [...baseSet].filter(name => /^packages\/.*\.m?js$/.test(name) && !planned.has(name))) {
    const source = execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (!source.includes('/')) continue;
    for (const value of rewriteStrings(source, { oldFile: file, newFile: ctx.mapper.map(file), files: baseSet, mapper: ctx.mapper }).stale) problems.push(`${file}: package-relative string "${value}" would go stale`);
  }
  return { problems, dataEdits };
}
