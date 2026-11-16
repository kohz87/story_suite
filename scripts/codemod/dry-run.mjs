// Runs one area's whole pipeline (moves, rewrites, verify, the area's moved tests) in a temp worktree and throws it away.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from './apply.mjs';
import { verifyApplied } from './verify-applied.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// A `node --test` child that inherits NODE_TEST_CONTEXT behaves as a sub-test and always exits 0.
function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

/**
 * Checks out HEAD of `repo` in a temp worktree (its `node_modules`, if any, linked in), applies `area` there with the
 * same two commits a real run makes, verifies, and runs the moved test files with `node --test` (skip with
 * `tests: false`; `after(worktree)` is called before it is removed and its result comes back as `after`). The worktree and its backup dir are always
 * removed (a deleting area backs up into a temp dir, never the caller's). Returns { report, problems, dataFiles, tests: { count, status, output } | null, after }.
 */
export function dryRun(repo, ruleSets, area, { allowNonLiteral = [], tests = true, codemap = false, after = null } = {}) {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-dry-'));
  fs.rmSync(worktree, { recursive: true });
  git(repo, ['worktree', 'add', '-q', '--detach', worktree, 'HEAD']);
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-dry-backup-'));
  try {
    const modules = path.join(repo, 'node_modules');
    if (fs.existsSync(modules)) fs.symlinkSync(modules, path.join(worktree, 'node_modules'));
    const base = git(worktree, ['rev-parse', 'HEAD']).trim();
    const commits = { moves: `layout: move ${area}`, rewrites: `layout: rewrite ${area}` };
    const report = applyLayout(worktree, ruleSets, { area, backupDir, allowNonLiteral, commits });
    const checked = verifyApplied(worktree, ruleSets, area, base, { codemap });
    let ran = null;
    if (tests) {
      const files = report.plan.moves.map(move => move.to).filter(file => /\.test\.[mc]?js$/.test(file));
      const result = files.length ? spawnSync('node', ['--test', ...files], { cwd: worktree, encoding: 'utf8', maxBuffer: 1 << 28, env: cleanEnv() }) : { status: 0 };
      ran = { count: files.length, status: result.status, output: result.status ? `${result.stdout ?? ''}${result.stderr ?? ''}` : '' };
    }
    return { report, problems: checked.problems, dataFiles: checked.dataFiles, tests: ran, after: after ? after(worktree) : null };
  } finally {
    try { fs.rmSync(path.join(worktree, 'node_modules'), { force: true }); } catch { /* none linked */ }
    git(repo, ['worktree', 'remove', '--force', worktree]);
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
}
