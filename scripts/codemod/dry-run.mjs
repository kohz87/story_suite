// Runs one area's whole pipeline (moves, rewrites, verify, the area's moved tests) in a temp worktree and throws it away.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from './apply.mjs';
import { verifyDiff, verifyTree } from './verify.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// A `node --test` child that inherits NODE_TEST_CONTEXT behaves as a sub-test and always exits 0.
function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

/** Verifies the two-commit result at `root` (base is the commit before the moves); returns the problem sentences. */
export function verifyApplied(root, ruleSets, area, base, { codemap = true } = {}) {
  const hasCodemap = codemap && fs.existsSync(path.join(root, 'scripts/codemap/cli.mjs'));
  return [
    ...verifyTree(root, ruleSets, { codemap: hasCodemap, area }),
    ...verifyDiff(root, base, 'HEAD~1', 'HEAD', ruleSets, { area }).problems,
  ];
}

/**
 * Checks out HEAD of `repo` in a temp worktree (its `node_modules`, if any, linked in), applies `area` there with the
 * same two commits a real run makes, verifies, and runs the moved test files with `node --test` (skip with
 * `tests: false`). The worktree is always removed. Returns { report, problems, tests: { count, status } | null }.
 */
export function dryRun(repo, ruleSets, area, { backupDir = null, allowNonLiteral = [], tests = true, codemap = true } = {}) {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-dry-'));
  fs.rmSync(worktree, { recursive: true });
  git(repo, ['worktree', 'add', '-q', '--detach', worktree, 'HEAD']);
  try {
    const modules = path.join(repo, 'node_modules');
    if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(worktree, 'node_modules'));
    const base = git(worktree, ['rev-parse', 'HEAD']).trim();
    const commits = { moves: `layout: move ${area}`, rewrites: `layout: rewrite ${area}` };
    const report = applyLayout(worktree, ruleSets, { area, backupDir, allowNonLiteral, commits });
    const problems = verifyApplied(worktree, ruleSets, area, base, { codemap });
    let ran = null;
    if (tests) {
      const files = report.plan.moves.map(move => move.to).filter(file => /\.test\.[mc]?js$/.test(file));
      const result = files.length ? spawnSync('node', ['--test', ...files], { cwd: worktree, encoding: 'utf8', maxBuffer: 1 << 28, env: cleanEnv() }) : { status: 0 };
      ran = { count: files.length, status: result.status, output: result.status ? `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').slice(-40).join('\n') : '' };
    }
    return { report, problems, tests: ran };
  } finally {
    try { fs.rmSync(path.join(worktree, 'node_modules'), { force: true }); } catch { /* none linked */ }
    git(repo, ['worktree', 'remove', '--force', worktree]);
  }
}
