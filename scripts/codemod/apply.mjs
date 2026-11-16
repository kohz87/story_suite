// Applies a plan to a working tree: git mv (deletes are backed up first), then the import and string rewriters.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildPlan, makeMapper, planProblems, trackedFiles } from './plan.mjs';
import { areaMapper, planForArea } from './area.mjs';
import { rewriteImports } from './rewrite-imports.mjs';
import { rewriteStrings } from './rewrite-strings.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function backUp(root, deletes, backupDir) {
  if (!deletes.length || !backupDir) return;
  fs.mkdirSync(backupDir, { recursive: true });
  for (const file of deletes) {
    fs.mkdirSync(path.dirname(path.join(backupDir, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(backupDir, file));
  }
  fs.writeFileSync(path.join(backupDir, 'MANIFEST.txt'), `${deletes.join('\n')}\n`);
}

// Removes the folders a move or delete left empty (git does not track them, but they would linger on disk).
function pruneEmpty(root, sources) {
  for (const source of sources) {
    for (let dir = path.dirname(source); dir !== '.'; dir = path.dirname(dir)) {
      const abs = path.join(root, dir);
      if (!fs.existsSync(abs) || fs.readdirSync(abs).length) break;
      fs.rmdirSync(abs);
    }
  }
}

/**
 * Applies the rule sets to the git tree at `root`: plans (throws listing every problem), moves files with `git mv`,
 * deletes `to: null` files after copying them with a MANIFEST.txt into `backupDir`, then rewrites imports and
 * string references. `commits` ({ moves, rewrites } messages) makes one commit after each step. With `area`, the
 * plan is made with all rule sets but only that area's moves and deletes are applied (and its problems refused), and
 * only that area's paths are rewritten; other areas' files stay where they are. Returns
 * { plan, rewritten, unresolved, removed, nonLiteral, stale, errors } for the caller to fail on.
 */
export function applyLayout(root, ruleSets, { backupDir = null, commits = null, allowNonLiteral = [], area = null } = {}) {
  const before = trackedFiles(root);
  const files = new Set(before);
  const { plan } = area ? planForArea(before, ruleSets, area) : { plan: buildPlan(before, ruleSets) };
  const problems = planProblems(plan, { files, readFile: file => fs.readFileSync(path.join(root, file), 'utf8') });
  if (problems.length) throw new Error(`plan refused:\n${problems.join('\n')}`);
  const mapper = area ? areaMapper(plan, ruleSets, area) : makeMapper(plan, ruleSets);
  backUp(root, plan.deletes, backupDir);
  for (const file of plan.deletes) git(root, ['rm', '-q', '--', file]);
  for (const move of plan.moves) {
    fs.mkdirSync(path.join(root, path.dirname(move.to)), { recursive: true });
    git(root, ['mv', '--', move.from, move.to]);
  }
  pruneEmpty(root, [...plan.moves.map(move => move.from), ...plan.deletes]);
  if (commits?.moves) { git(root, ['add', '-A']); git(root, ['commit', '-q', '--allow-empty', '-m', commits.moves]); }
  const deleted = new Set(plan.deletes);
  const newToOld = new Map(plan.moves.map(move => [move.to, move.from]));
  const report = { plan, rewritten: 0, unresolved: [], removed: [], nonLiteral: [], stale: [], errors: [] };
  for (const oldFile of before) {
    if (deleted.has(oldFile)) continue;
    const newFile = mapper.map(oldFile);
    if (!/\.(m?js|json|txt|md|ya?ml)$/.test(newFile)) continue;
    const abs = path.join(root, newFile);
    const original = fs.readFileSync(abs, 'utf8');
    const ctx = { oldFile: newToOld.get(newFile) ?? oldFile, newFile, files, mapper };
    let text = original;
    if (/\.m?js$/.test(newFile)) {
      const imports = rewriteImports(text, ctx);
      if (imports.error) report.errors.push(`${oldFile}: ${imports.error}`);
      for (const item of imports.unresolved) report.unresolved.push({ file: oldFile, ...item });
      for (const item of imports.removed) report.removed.push({ file: oldFile, ...item });
      if (!allowNonLiteral.includes(oldFile)) for (const item of imports.nonLiteral) report.nonLiteral.push({ file: oldFile, ...item });
      text = imports.source;
    }
    const strings = rewriteStrings(text, ctx);
    if (strings.error) report.errors.push(`${oldFile}: ${strings.error}`);
    for (const value of strings.stale) report.stale.push({ file: oldFile, value });
    text = strings.source;
    if (text !== original) { fs.writeFileSync(abs, text); report.rewritten += 1; }
  }
  if (commits?.rewrites) { git(root, ['add', '-A']); git(root, ['commit', '-q', '--allow-empty', '-m', commits.rewrites]); }
  return report;
}
