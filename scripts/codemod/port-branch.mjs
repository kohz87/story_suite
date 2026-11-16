// Ports a lane branch to the new layout in a temp worktree and then merges main, so only real conflicts are left.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from './apply.mjs';

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

/**
 * Checks `branch` out in a temp worktree of `repo`, runs the same layout on its tree, commits "layout: port to <area>",
 * then merges `mainRef`. With `area`, only that area's moves are applied. Returns { worktree, report, merged, conflicts }; the worktree is removed when the merge is
 * clean and kept (so the conflicts can be fixed in it) otherwise. Throws if the plan is refused.
 */
export function portBranch(repo, branch, ruleSets, { mainRef = 'origin/main', backupDir = null, allowNonLiteral = [], area = null } = {}) {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'port-branch-'));
  fs.rmSync(worktree, { recursive: true });
  git(repo, ['worktree', 'add', '-q', worktree, branch]);
  let report;
  try {
    report = applyLayout(worktree, ruleSets, { backupDir, allowNonLiteral, area });
    git(worktree, ['add', '-A']);
    git(worktree, ['commit', '-q', '--allow-empty', '-m', `layout: port to ${area ?? ruleSets.map(set => set.area).join(', ')}`]);
  } catch (error) {
    git(repo, ['worktree', 'remove', '--force', worktree]);
    throw error;
  }
  let merged = true;
  let conflicts = [];
  try {
    git(worktree, ['merge', '--no-edit', '-q', '-X', 'find-renames=30%', mainRef]);
  } catch {
    merged = false;
    conflicts = git(worktree, ['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
  }
  if (merged) git(repo, ['worktree', 'remove', '--force', worktree]);
  return { worktree, report, merged, conflicts };
}
