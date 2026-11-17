// The `apply`, `verify` and `port-branch` CLI commands: each takes an area, runs it and writes a summary. Returns an exit code.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { applyLayout } from './apply.mjs';
import { dropKnownProblems, occurringStale, splitApplyKnown } from './apply-known.mjs';
import { dryRun } from './dry-run.mjs';
import { verifyApplied } from './verify-applied.mjs';
import { portBranch } from './port-branch.mjs';
import { trackedFiles } from './plan.mjs';
import { planForArea } from './area.mjs';
import { tempDir } from '../temp-dir.mjs';

const head = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const entry = item => (typeof item === 'string' ? item : `${item.file}${item.line ? `:${item.line}` : ''} ${item.spec ?? item.value ?? item.kind ?? ''}`.trim());

// Every entry of every list is written, one per line: the operator needs the full list to act on it.
function summary(stdout, area, report) {
  stdout.write(`${area}: ${report.plan.moves.length} moves, ${report.plan.deletes.length} deletes, ${report.rewritten} files rewritten\n`);
  if (report.allowedNonLiteral) stdout.write(`non-literal specifiers in allow-listed files: ${report.allowedNonLiteral} (not judged)\n`);
  for (const [label, list] of [['unresolved before the move (not this run\'s problem)', report.unresolved], ['removed', report.removed], ['non-literal (not allow-listed)', report.nonLiteral], ['stale package-relative strings', report.stale], ['errors', report.errors]]) {
    if (!list.length) continue;
    stdout.write(`${label} (${list.length}):\n`);
    for (const item of list) stdout.write(`  ${entry(item)}\n`);
  }
}

function listData(stdout, files) {
  if (!files?.length) return;
  stdout.write(`non-JS files changed by the rewrite commit (listed, not judged): ${files.length}\n`);
  for (const file of files) stdout.write(`  ${file}\n`);
}

// Unresolved specifiers are the ones that already failed before the move: verify judges whether the move added any.
const loud = (report, fresh = report.stale) => report.nonLiteral.length + fresh.length + report.errors.length;

// Names what a shrink-only known list covered, and the lines that no longer occur (remove them).
function showKnown(stdout, report, split) {
  const covered = report.stale.length - split.stale.length;
  if (covered) stdout.write(`stale strings named in the known list: ${covered} (not judged)\n`);
  for (const line of split.unused) stdout.write(`known-list line no longer occurs, remove it: ${line}\n`);
}

function showTests(stdout, ran, split) {
  if (!ran) return;
  if (ran.status === 0) { stdout.write(`tests: ${ran.count} moved test files, passed\n`); return; }
  if (!split.tests.length) { stdout.write(`tests: ${ran.count} moved test files, all failures named in the known list (not judged)\n`); return; }
  const file = path.join(tempDir('codemod-tests-'), 'output.txt');
  fs.writeFileSync(file, ran.output);
  stdout.write(`tests: ${ran.count} moved test files, FAILED (exit ${ran.status}); full output in ${file}; last lines:\n${ran.output.split('\n').slice(-60).join('\n')}\n`);
}

/** `apply --area <a> [--dry] [--backup <dir>]`: applies one area. Without `--dry` it works in `root` (which must be clean) and makes two commits. */
export function runApply(root, ruleSets, area, { dry, backupDir, allowNonLiteral = [], known = [], codemap = false, stdout, stderr }) {
  try {
    if (dry) {
      const result = dryRun(root, ruleSets, area, { allowNonLiteral, codemap, after: tree => occurringStale(tree, ruleSets, known) });
      const split = splitApplyKnown(result.report, result.tests, known, result.after);
      summary(stdout, area, { ...result.report, stale: split.stale });
      showKnown(stdout, result.report, split);
      listData(stdout, result.dataFiles);
      showTests(stdout, result.tests, split);
      const problems = dropKnownProblems(result.problems, known).fresh;
      for (const problem of problems) stderr.write(`verify: ${problem}\n`);
      return problems.length || loud(result.report, split.stale) || split.tests.length ? 1 : 0;
    }
    const mine = planForArea(trackedFiles(root), ruleSets, area).plan;
    if (mine.deletes.length && !backupDir) {
      stderr.write(`${area} deletes ${mine.deletes.length} files: pass --backup <dir>\n`);
      return 1;
    }
    if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
      stderr.write('the tree is not clean: commit or remove your changes first (apply commits everything it finds)\n');
      return 1;
    }
    const base = head(root);
    const report = applyLayout(root, ruleSets, { area, backupDir: backupDir && path.resolve(root, backupDir), allowNonLiteral, commits: { moves: `layout: move ${area}`, rewrites: `layout: rewrite ${area}` } });
    const split = splitApplyKnown(report, null, known, occurringStale(root, ruleSets, known));
    summary(stdout, area, { ...report, stale: split.stale });
    showKnown(stdout, report, split);
    const checked = verifyApplied(root, ruleSets, area, base, { codemap });
    listData(stdout, checked.dataFiles);
    const problems = dropKnownProblems(checked.problems, known).fresh;
    for (const problem of problems) stderr.write(`verify: ${problem}\n`);
    return problems.length || loud(report, split.stale) ? 1 : 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

/**
 * `verify --area <a> [--base <ref>] [--moves <ref>] [--rewrites <ref>]`: checks the tree after an apply. `base` is the
 * commit before the move commit (default HEAD~2), `moves` the move commit (HEAD~1) and `rewrites` the rewrite commit
 * (HEAD); name them when a fix-up commit follows the rewrite commit. `tip` is the area's last commit (default: the
 * working tree): name it to verify an area once later areas were applied on top, which is how the batch verifies each area. The code map check runs unless `codemap` is false (or `tip` is named).
 */
export function runVerify(root, ruleSets, area, { base = 'HEAD~2', moves = 'HEAD~1', rewrites = 'HEAD', tip = null, codemap = tip === null, known = [], stdout, stderr }) {
  try {
    const checked = verifyApplied(root, ruleSets, area, base, { codemap, moves, head: rewrites, tip });
    listData(stdout, checked.dataFiles);
    const problems = dropKnownProblems(checked.problems, known).fresh;
    for (const problem of problems) stderr.write(`verify: ${problem}\n`);
    stdout.write(`${area}: ${problems.length ? `${problems.length} problems` : 'verified'}\n`);
    return problems.length ? 1 : 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

/** `port-branch <branch> --area <a> [--main <ref>] [--backup <dir>]`: ports a lane branch with one area's moves and merges main. */
export function runPort(root, ruleSets, area, branch, { mainRef = 'origin/main', backupDir, allowNonLiteral = [], stdout, stderr }) {
  try {
    const result = portBranch(root, branch, ruleSets, { mainRef, backupDir: backupDir && path.resolve(root, backupDir), allowNonLiteral, area });
    stdout.write(`${branch}: ${result.merged ? 'merged clean' : `${result.conflicts.length} conflicts in ${result.worktree}`}\n`);
    for (const file of result.conflicts) stdout.write(`  conflict: ${file}\n`);
    return result.merged ? 0 : 1;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}
