import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyLayout } from '../../scripts/codemod/apply.mjs';
import { portBranch } from '../../scripts/codemod/port-branch.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY, TOY_RULES, git, toyRepo, writeFiles } from './codemod-toy.js';

const rules = parseRules(TOY_RULES);

function laneAndMain(laneEdit) {
  const root = toyRepo(TOY);
  git(root, 'checkout', '-q', '-b', 'lane');
  writeFiles(root, laneEdit);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lane work');
  git(root, 'checkout', '-q', 'main');
  applyLayout(root, [rules]);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'layout');
  return root;
}

test('a lane branch with a new file and an edit ports and merges main with no conflicts', () => {
  const root = laneAndMain({
    'pkg/src/store-parts/b.js': "import { store } from '../store.js';\nexport const b = store;\n",
    'pkg/src/ui/view.js': `${TOY['pkg/src/ui/view.js']}export const extra = 1;\n`,
  });
  const result = portBranch(root, 'lane', [rules], { mainRef: 'main' });
  assert.equal(result.merged, true);
  assert.deepEqual(result.conflicts, []);
  assert.equal(fs.existsSync(result.worktree), false);
  git(root, 'checkout', '-q', 'lane');
  assert.equal(fs.readFileSync(path.join(root, 'core/store-parts/b.js'), 'utf8').includes("'../store.js'"), true);
  assert.match(fs.readFileSync(path.join(root, 'ui/legacy/view.js'), 'utf8'), /export const extra = 1;/);
  assert.match(fs.readFileSync(path.join(root, 'ui/legacy/view.js'), 'utf8'), /'\.\.\/\.\.\/core\/store\.js'/);
  assert.equal(fs.existsSync(path.join(root, 'pkg')), false);
  assert.match(git(root, 'log', '--format=%s', '--grep=layout: port'), /layout: port to toy/);
});

test('a real content conflict is left in a kept worktree and named', () => {
  const root = toyRepo(TOY);
  git(root, 'checkout', '-q', '-b', 'lane');
  writeFiles(root, { 'pkg/src/runtime/run.js': 'export const run = 2;\n' });
  git(root, 'commit', '-q', '-am', 'lane edit');
  git(root, 'checkout', '-q', 'main');
  applyLayout(root, [rules]);
  writeFiles(root, { 'core/runtime/run.js': 'export const run = 3;\n' });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'layout and edit');
  const result = portBranch(root, 'lane', [rules], { mainRef: 'main' });
  assert.equal(result.merged, false);
  assert.deepEqual(result.conflicts, ['core/runtime/run.js']);
  assert.equal(fs.existsSync(result.worktree), true);
  git(root, 'worktree', 'remove', '--force', result.worktree);
});

test('a refused plan removes the temp worktree and throws', () => {
  const root = laneAndMain({ 'pkg/stray.js': 'export {};\n' });
  assert.throws(() => portBranch(root, 'lane', [rules], { mainRef: 'main' }), /no rule covers pkg\/stray\.js/);
  assert.equal(git(root, 'worktree', 'list').trim().split('\n').length, 1);
});
