import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap } from '../../scripts/codemap/build-map.mjs';
import { checkExportsRatchet, parseExportsList } from '../../scripts/checks/legacy-exports.mjs';

const BIG = '// Big.\nexport const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\nexport const e = 5;\n';
const SMALL = '// Small.\nexport const a = 1;\n';
const build = (text, legacyExports) => buildMap({
  files: ['modules/x/big.js'], readSource: () => text, jobs: { 'modules/x/big.js': 'Does it.' }, legacyExports,
});

test('parseExportsList reads one path per line, skipping comments and blanks', () => {
  assert.deepEqual([...parseExportsList('# note\n\nmodules/a.js\n  modules/b.js  \n')], ['modules/a.js', 'modules/b.js']);
});

test('a file over the export limit fails unless it is on the list', () => {
  assert.match(build(BIG, new Set()).problems.join('\n'), /5 exports/);
  assert.deepEqual(build(BIG, new Set(['modules/x/big.js'])).problems, []);
});

test('a listed file that is back within the limit, or gone, is a problem (the list only shrinks)', () => {
  assert.match(build(SMALL, new Set(['modules/x/big.js'])).problems.join('\n'), /remove it from the legacy exports list/);
  assert.match(build(BIG, new Set(['modules/x/big.js', 'modules/x/gone.js'])).problems.join('\n'), /gone\.js: is on the legacy exports list but the file does not exist/);
});

test('the ratchet refuses a path the base list does not have, and allows shrinking', () => {
  assert.deepEqual(checkExportsRatchet({ current: new Set(['a']), base: new Set(['a', 'b']) }).errors, []);
  assert.deepEqual(checkExportsRatchet({ current: new Set(['a', 'c']), base: new Set(['a']) }).errors, ['c: added to the legacy exports list']);
});
