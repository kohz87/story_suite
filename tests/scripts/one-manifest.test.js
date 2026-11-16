import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestProblems } from '../../scripts/checks/one-manifest.mjs';

test('the root manifest alone is fine; kept history and example packs may hold their own', () => {
  assert.deepEqual(manifestProblems('manifest.json\nindex.js\ndocs/history/packages/x/manifest.json\nexamples/fishing/manifest.json\n'), []);
});

test('a second manifest.json anywhere else is refused', () => {
  assert.deepEqual(manifestProblems('manifest.json\nui/manifest.json\nmodules/people/manifest.json\n'), [
    'ui/manifest.json: a second manifest.json; Story Suite has one, at the repo root',
    'modules/people/manifest.json: a second manifest.json; Story Suite has one, at the repo root',
  ]);
});

test('no root manifest is refused', () => {
  assert.deepEqual(manifestProblems('index.js\n'), ['manifest.json: the root manifest is missing']);
});
