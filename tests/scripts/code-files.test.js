import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCodeFile, isTestFile } from '../../scripts/checks/code-files.mjs';

test('code files are js, mjs, cjs, ts, css, sh and py', () => {
  for (const p of ['core/a.js', 'x/b.mjs', 'c.cjs', 'ui/s.css', 'a/b.ts', 'scripts/ci/x.sh', 'tests/probe.py']) assert.equal(isCodeFile(p), true, p);
  for (const p of ['README.md', 'data.json', 'img/a.webp', 'a.js.map', 'x.html', 'tests/fixtures/data.jsonl']) assert.equal(isCodeFile(p), false, p);
});

test('jsx, tsx, bash and zsh are checked; extensionless files are not', () => {
  for (const p of ['ui/a.jsx', 'ui/b.tsx', 'scripts/x.bash', 'scripts/y.zsh']) assert.equal(isCodeFile(p), true, p);
  for (const p of ['scripts/run', 'bin/tool', 'Makefile']) assert.equal(isCodeFile(p), false, p);
});

test('vendored copies, node_modules and data files are not checked', () => {
  for (const p of [
    'packages/story-director/tests/vendor/story-block/src/v2/store.js',
    'packages/x/vendor/lib.js',
    'packages/npc-state-delta/tests/fixtures/big.json',
    'node_modules/a/index.js',
    'packages/a/node_modules/b.js',
  ]) assert.equal(isCodeFile(p), false, p);
});

test('code under fixtures is checked, data under fixtures is not', () => {
  assert.equal(isCodeFile('packages/a/tests/fixtures/helper.js'), true);
  assert.equal(isCodeFile('packages/a/tests/fixtures/data.json'), false);
});

test('test files: under a tests/ or test/ folder, or named *.test.*', () => {
  for (const p of ['tests/scripts/a.test.js', 'packages/a/tests/helper.mjs', 'test/x.js', 'core/y.test.mjs']) assert.equal(isTestFile(p), true, p);
  for (const p of ['core/tests.js', 'scripts/latest/a.js', 'core/a.js']) assert.equal(isTestFile(p), false, p);
});
