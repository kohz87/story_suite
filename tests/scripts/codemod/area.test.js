import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { applyLayout } from '../../../scripts/codemod/apply.mjs';
import { planForArea } from '../../../scripts/codemod/area.mjs';
import { verifyDiff, verifyTree } from '../../../scripts/codemod/verify.mjs';
import { parseRules } from '../../../scripts/codemod/rules.mjs';
import { SET_A, SET_B, TOY, TOY_RULES, git, toyRepo } from '../codemod-toy.js';

const [, , ui, tests] = TOY_RULES.rules;
const sets = [SET_A, SET_B];
const commits = { moves: 'move', rewrites: 'rewrite' };
const exists = (root, file) => fs.existsSync(path.join(root, file));

test('applying area a moves only a\'s files; b\'s files stay and their imports of a are rewritten', () => {
  const root = toyRepo(TOY);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  const report = applyLayout(root, sets, { area: 'a', commits });
  assert.equal(report.plan.moves.length, 3);
  for (const file of ['core/store.js', 'core/store-parts/a.js', 'core/runtime/run.js']) assert.equal(exists(root, file), true, file);
  for (const file of ['pkg/src/ui/view.js', 'pkg/src/ui/index.js', 'pkg/src/ui/view.css', 'pkg/tests/store.test.js']) assert.equal(exists(root, file), true, file);
  assert.equal(exists(root, 'ui/legacy'), false);
  assert.equal(exists(root, 'tests/core'), false);
  assert.match(fs.readFileSync(path.join(root, 'pkg/src/ui/index.js'), 'utf8'), /'\.\.\/\.\.\/\.\.\/core\/store\.js'/);
  assert.deepEqual(verifyTree(root, sets, { area: 'a' }), []);
  assert.deepEqual(verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'a' }).problems, []);
});

test('verify for area a fails while a is unapplied, and area b is not judged by a\'s files', () => {
  const root = toyRepo(TOY);
  assert.match(verifyTree(root, sets, { area: 'a' }).join('\n'), /pkg\/src\/store\.js is still at its old location/);
  assert.equal(verifyTree(root, sets, { area: 'b' }).some(line => line.includes('pkg/src/store.js')), false);
});

test('a second area applied after the first works and the whole tree then verifies', () => {
  const root = toyRepo(TOY);
  applyLayout(root, sets, { area: 'a', commits });
  const base = git(root, 'rev-parse', 'HEAD').trim();
  const report = applyLayout(root, sets, { area: 'b', commits });
  assert.equal(report.plan.moves.length, 4);
  assert.deepEqual([report.unresolved, report.nonLiteral, report.errors], [[], [], []]);
  assert.equal(fs.existsSync(path.join(root, 'pkg')), false);
  assert.equal(fs.readFileSync(path.join(root, 'ui/legacy/index.js'), 'utf8'), "export * from '../../core/store.js';\n");
  assert.deepEqual(verifyTree(root, sets, { area: 'b' }), []);
  assert.deepEqual(verifyTree(root, sets), []);
  assert.deepEqual(verifyDiff(root, base, 'HEAD~1', 'HEAD', sets, { area: 'b' }).problems, []);
});

test('plan problems are limited to the area: b\'s live import of a delete does not block a', () => {
  const rules = parseRules({ area: 'b', scope: ['pkg'], rules: [ui, tests, { from: 'pkg/src/old', to: null }] });
  const root = toyRepo({ ...TOY, 'pkg/src/old/x.js': 'export const x = 1;\n', 'pkg/src/ui/uses.js': "import { x } from '../old/x.js';\nexport { x };\n" });
  assert.throws(() => applyLayout(root, [SET_A, rules], { area: 'b', backupDir: path.join(root, '..', 'bk') }), /still imported by pkg\/src\/ui\/uses\.js/);
  assert.equal(applyLayout(root, [SET_A, rules], { area: 'a' }).plan.moves.length, 3);
});

test('an unmatched file blocks only the area it would be stranded in', () => {
  const files = [...Object.keys(TOY), 'pkg/src/other.js'];
  assert.throws(() => planForArea(files, [SET_A], 'zzz'), /no rule set for area zzz/);
  assert.deepEqual(planForArea(files, sets, 'a').plan.unmatched, ['pkg/src/other.js']);
  assert.deepEqual(planForArea(files, sets, 'b').plan.unmatched, []);
});
