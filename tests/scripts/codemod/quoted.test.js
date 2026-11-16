import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatten, quotedValues } from '../../../scripts/codemod/quoted.mjs';

const LINE = "    assert.ok(!/import[^;]*index\\.v1\\.js|from '\\.\\/src\\/(?!v2\\/)/.test(readFileSync(new URL('../../index.js', import.meta.url), 'utf8')), 'v1 is not loaded');";

test('a quote inside a regex literal is not a string: only the real strings are emptied and listed', () => {
  assert.deepEqual(quotedValues(LINE), ['../../index.js', 'utf8', 'v1 is not loaded']);
  const moved = LINE.replace('../../index.js', '../../packages/story-block/index.js');
  assert.equal(flatten(LINE), flatten(moved));
  assert.match(flatten(LINE), /\/import\[\^;\]\*index/);
});

test('flatten still empties plain strings and keeps a changed regex visible', () => {
  assert.equal(flatten("import { a } from './x.js';"), "import { a } from '';");
  assert.notEqual(flatten('const r = /a\\/b/;'), flatten('const r = /a\\/c/;'));
  assert.deepEqual(quotedValues("const half = total / 2; log('a / b', \"c\");"), ['a / b', 'c']);
});
