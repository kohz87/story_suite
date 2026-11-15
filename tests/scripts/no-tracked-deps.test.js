import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackedDepsProblems } from '../../scripts/checks/no-tracked-deps.mjs';

test('flags a root node_modules symlink', () => {
  const lsFiles = [
    '100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0\tpackage.json',
    '120000 1111111111111111111111111111111111111111 0\tnode_modules',
  ].join('\n');
  assert.deepEqual(trackedDepsProblems(lsFiles), ['node_modules: node_modules must not be tracked']);
});

test('flags a nested file under a node_modules folder', () => {
  const lsFiles = [
    '100644 2222222222222222222222222222222222222222 0\tpackages/story-block/node_modules/pkg/index.js',
  ].join('\n');
  assert.deepEqual(trackedDepsProblems(lsFiles), [
    'packages/story-block/node_modules/pkg/index.js: node_modules must not be tracked',
  ]);
});

test('allows paths that only contain node_modules as part of a segment', () => {
  const lsFiles = [
    '100644 3333333333333333333333333333333333333333 0\tdocs/node_modules-notes.md',
    '100644 4444444444444444444444444444444444444444 0\tscripts/checks/no-tracked-deps.mjs',
  ].join('\n');
  assert.deepEqual(trackedDepsProblems(lsFiles), []);
});

test('returns no problems for a clean ls-files list', () => {
  const lsFiles = [
    '100644 5555555555555555555555555555555555555555 0\tpackage.json',
    '100644 6666666666666666666666666666666666666666 0\tscripts/checks/code-files.mjs',
    '',
  ].join('\n');
  assert.deepEqual(trackedDepsProblems(lsFiles), []);
});
