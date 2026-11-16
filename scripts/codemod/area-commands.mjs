// The `apply`, `verify` and `port-branch` CLI commands: each takes an area, runs it and writes a summary. Returns an exit code.
import { applyLayout } from './apply.mjs';
import { dryRun, verifyApplied } from './dry-run.mjs';
import { portBranch } from './port-branch.mjs';
import { trackedFiles } from './plan.mjs';
import { planForArea } from './area.mjs';
import { execFileSync } from 'node:child_process';

const head = root => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

function summary(stdout, area, report) {
  stdout.write(`${area}: ${report.plan.moves.length} moves, ${report.plan.deletes.length} deletes, ${report.rewritten} files rewritten\n`);
  for (const [label, list] of [['unresolved', report.unresolved], ['removed', report.removed], ['non-literal', report.nonLiteral], ['stale', report.stale], ['errors', report.errors]]) {
    if (list.length) stdout.write(`${label} (${list.length}): ${JSON.stringify(list.slice(0, 5))}\n`);
  }
}

const loud = report => report.unresolved.length + report.nonLiteral.length + report.stale.length + report.errors.length;

/** `apply --area <a> [--dry]`: applies one area. Without `--dry` it works in `root` and makes two commits. */
export function runApply(root, ruleSets, area, { dry, backupDir, stdout, stderr }) {
  const mine = planForArea(trackedFiles(root), ruleSets, area).plan;
  if (mine.deletes.length && !backupDir) {
    stderr.write(`${area} deletes ${mine.deletes.length} files: pass --backup <dir>\n`);
    return 1;
  }
  try {
    if (dry) {
      const result = dryRun(root, ruleSets, area, { backupDir });
      summary(stdout, area, result.report);
      if (result.tests) stdout.write(`tests: ${result.tests.count} moved test files, ${result.tests.status === 0 ? 'passed' : `FAILED (exit ${result.tests.status})\n${result.tests.output}`}\n`);
      for (const problem of result.problems) stderr.write(`verify: ${problem}\n`);
      return result.problems.length || loud(result.report) || result.tests?.status ? 1 : 0;
    }
    const base = head(root);
    const report = applyLayout(root, ruleSets, { area, backupDir, commits: { moves: `layout: move ${area}`, rewrites: `layout: rewrite ${area}` } });
    summary(stdout, area, report);
    const problems = verifyApplied(root, ruleSets, area, base);
    for (const problem of problems) stderr.write(`verify: ${problem}\n`);
    return problems.length || loud(report) ? 1 : 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

/** `verify --area <a> [--base <ref>]`: checks the tree after an apply; `base` is the commit before the move commit (default HEAD~2). */
export function runVerify(root, ruleSets, area, { base = 'HEAD~2', stdout, stderr }) {
  try {
    const problems = verifyApplied(root, ruleSets, area, base);
    for (const problem of problems) stderr.write(`verify: ${problem}\n`);
    stdout.write(`${area}: ${problems.length ? `${problems.length} problems` : 'verified'}\n`);
    return problems.length ? 1 : 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

/** `port-branch <branch> --area <a> [--main <ref>]`: ports a lane branch with one area's moves and merges main. */
export function runPort(root, ruleSets, area, branch, { mainRef = 'origin/main', backupDir, stdout, stderr }) {
  try {
    const result = portBranch(root, branch, ruleSets, { mainRef, backupDir, area });
    stdout.write(`${branch}: ${result.merged ? 'merged clean' : `${result.conflicts.length} conflicts in ${result.worktree}`}\n`);
    for (const file of result.conflicts) stdout.write(`  conflict: ${file}\n`);
    return result.merged ? 0 : 1;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}
