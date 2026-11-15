import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerJob } from '../../scripts/codemap/header-job.mjs';

test('takes the first sentence of a line-comment header', () => {
  assert.equal(headerJob('// Does the thing. Then more.\n// Second line.\nexport const a = 1;\n'), 'Does the thing.');
});

test('joins wrapped line comments and skips a shebang', () => {
  assert.equal(headerJob('#!/usr/bin/env node\n// Runs the\n// whole check.\n'), 'Runs the whole check.');
});

test('reads a block comment and a doc comment', () => {
  assert.equal(headerJob('/*\n * Block job here.\n * More.\n */\nx'), 'Block job here.');
  assert.equal(headerJob('/** Doc job. */\nexport {};'), 'Doc job.');
});

test('does not end the sentence at e.g., i.e. or etc.', () => {
  assert.equal(headerJob('// badge: an icon with a counter, e.g. a count. Next.\n'), 'badge: an icon with a counter, e.g. a count.');
  assert.equal(headerJob('// Reads files, i.e. the ones it needs. Next.\n'), 'Reads files, i.e. the ones it needs.');
});

test('returns null without an opening comment and caps long sentences at 200 characters', () => {
  assert.equal(headerJob('export const a = 1;\n// later comment\n'), null);
  assert.equal(headerJob(''), null);
  const long = headerJob(`// ${'word '.repeat(80)}.\n`);
  assert.equal(long.length, 200);
  assert.ok(long.endsWith('…'));
});
