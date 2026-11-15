import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCodeFile, isTestFile } from '../../scripts/checks/code-files.mjs';

test('code files are js, mjs, cjs and css', () => {
  for (const p of ['core/a.js', 'x/b.mjs', 'c.cjs', 'ui/s.css']) assert.equal(isCodeFile(p), true, p);
  for (const p of ['README.md', 'data.json', 'img/a.webp', 'a.js.map', 'x.html', 'script.sh']) assert.equal(isCodeFile(p), false, p);
});

test('vendored copies, fixtures and node_modules are not checked', () => {
  for (const p of [
    'packages/story-director/tests/vendor/story-block/src/v2/store.js',
    'packages/x/vendor/lib.js',
    'packages/npc-state-delta/tests/fixtures/big.js',
    'node_modules/a/index.js',
    'packages/a/node_modules/b.js',
  ]) assert.equal(isCodeFile(p), false, p);
});

test('test files: under a tests/ or test/ folder, or named *.test.*', () => {
  for (const p of ['tests/scripts/a.test.js', 'packages/a/tests/helper.mjs', 'test/x.js', 'core/y.test.mjs']) assert.equal(isTestFile(p), true, p);
  for (const p of ['core/tests.js', 'scripts/latest/a.js', 'core/a.js']) assert.equal(isTestFile(p), false, p);
});
