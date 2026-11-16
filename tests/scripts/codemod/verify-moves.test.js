import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyLayout } from '../../../scripts/codemod/apply.mjs';
import { verifyApplied } from '../../../scripts/codemod/verify-applied.mjs';
import { verifyDiff, verifyTree } from '../../../scripts/codemod/verify.mjs';
import { unresolvedBaseline } from '../../../scripts/codemod/baseline.mjs';
import { SET_A, SET_B } from '../codemod-sets.js';
import { TOY, git, toyRepo } from '../codemod-toy.js';

const sets = [SET_A, SET_B];
const commits = { moves: 'move', rewrites: 'rewrite' };
const FILES = { ...TOY, 'pkg/src/ui/extra.js': 'export const extra = 1;\n', 'pkg/src/ui/notes.md': 'notes\n' };

// Applies area a on a repo where `rogue` ran first, so its changes land in the move commit.
function applyWith(rogue) {
  const root = toyRepo(FILES);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  rogue?.(root);
  applyLayout(root, sets, { area: 'a', commits });
  return { root, base };
}

test('verify passes when the move commit holds exactly the area\'s planned moves', () => {
  const { root, base } = applyWith(null);
  assert.deepEqual(verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems, []);
});

test('verify fails on a rogue rename of another area\'s file in the move commit', () => {
  const { root, base } = applyWith(r => { fs.mkdirSync(path.join(r, 'ui/legacy'), { recursive: true }); git(r, 'mv', 'pkg/src/ui/extra.js', 'ui/legacy/extra.js'); });
  const problems = verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems;
  assert.ok(problems.some(line => line.includes('renames pkg/src/ui/extra.js -> ui/legacy/extra.js, which is not a planned move')), problems.join('\n'));
});

test('verify fails on a rogue rename that lands a planned file at the wrong place', () => {
  const { root, base } = applyWith(r => { fs.mkdirSync(path.join(r, 'core/elsewhere'), { recursive: true }); git(r, 'mv', 'pkg/src/runtime/run.js', 'core/elsewhere/run.js'); });
  assert.ok(verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems.some(line => line.includes('not a planned move')));
});

test('verify fails on a rogue delete in the move commit', () => {
  const { root, base } = applyWith(r => git(r, 'rm', '-q', 'pkg/src/ui/notes.md'));
  const problems = verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems;
  assert.ok(problems.some(line => line.includes('deletes pkg/src/ui/notes.md, which is not a planned delete')), problems.join('\n'));
});

test('verify fails on a content change, in the move commit and in the rewrite commit', () => {
  const edited = applyWith(r => fs.appendFileSync(path.join(r, 'pkg/src/runtime/run.js'), 'export const sneaky = 2;\n'));
  assert.ok(verifyDiff(edited.root, edited.base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems.length > 0);
  const { root, base } = applyWith(null);
  fs.writeFileSync(path.join(root, 'core/store.js'), fs.readFileSync(path.join(root, 'core/store.js'), 'utf8').replace('= run;', '= run + 1;'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'edit');
  assert.ok(verifyDiff(root, base, 'HEAD~2', 'HEAD', sets, { area: 'a' }).problems.some(line => line.startsWith('core/store.js: content line changed')));
});

test('a specifier that was already broken before the move is not the area\'s problem; a new break is', () => {
  const root = toyRepo({ ...FILES, 'pkg/src/store-parts/a.js': "import { store } from '../store.js';\nimport '../../../outside.js';\nexport const a = store;\n" });
  const base = git(root, 'rev-parse', 'HEAD').trim();
  assert.equal(unresolvedBaseline(root, base).counts.get('pkg/src/store-parts/a.js'), 1);
  applyLayout(root, sets, { area: 'a', commits });
  assert.ok(verifyTree(root, sets, { area: 'a' }).some(line => line.includes('outside.js')), 'without a baseline it is reported');
  assert.deepEqual(verifyApplied(root, sets, 'a', base, { codemap: false }).problems, []);
  const file = path.join(root, 'core/store-parts/a.js');
  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}import './nowhere.js';\n`);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'break');
  const problems = verifyApplied(root, sets, 'a', base, { codemap: false, moves: 'HEAD~2', head: 'HEAD~1' }).problems;
  assert.deepEqual(problems.map(line => line.replace(/:\d+:/, ':')), ['core/store-parts/a.js: "./nowhere.js" resolves to no tracked file']);
});

test('verify lists the non-JS files the rewrite commit changed', () => {
  const { root, base } = applyWith(null);
  fs.writeFileSync(path.join(root, 'pkg/src/ui/notes.md'), 'changed\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'doc');
  assert.deepEqual(verifyDiff(root, base, 'HEAD~2', 'HEAD', sets, { area: 'a' }).dataFiles, ['pkg/src/ui/notes.md']);
});
