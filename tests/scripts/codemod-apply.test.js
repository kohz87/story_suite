import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from '../../scripts/codemod/apply.mjs';
import { verifyDiff, verifyTree } from '../../scripts/codemod/verify.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { TOY, TOY_RULES, git, toyRepo } from './codemod-toy.js';

const rules = parseRules(TOY_RULES);

test('applyLayout moves files, rewrites imports, commits twice, and the result verifies', () => {
  const root = toyRepo(TOY);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  const report = applyLayout(root, [rules], { commits: { moves: 'layout: move', rewrites: 'layout: rewrite' } });
  assert.equal(report.plan.moves.length, 7);
  assert.deepEqual([report.unresolved, report.removed, report.nonLiteral, report.errors], [[], [], [], []]);
  assert.equal(fs.readFileSync(path.join(root, 'ui/legacy/view.js'), 'utf8').includes("'../../core/store.js'"), true);
  assert.equal(fs.existsSync(path.join(root, 'pkg')), false);
  assert.deepEqual(verifyTree(root, [rules]), []);
  const diff = verifyDiff(root, base, 'HEAD~1');
  assert.deepEqual(diff.problems, []);
  assert.equal(fs.readFileSync(path.join(root, 'ui/legacy/index.js'), 'utf8'), "export * from '../../core/store.js';\n");
  assert.equal(git(root, 'log', '--format=%s', '-2').trim().split('\n').join('|'), 'layout: rewrite|layout: move');
});

test('running the layout a second time changes nothing', () => {
  const root = toyRepo(TOY);
  applyLayout(root, [rules]);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'one');
  const again = applyLayout(root, [rules]);
  assert.equal(again.plan.moves.length, 0);
  assert.equal(again.rewritten, 0);
});

test('deleted files are backed up with a manifest before they go', () => {
  const root = toyRepo({ ...TOY, 'pkg/src/old/x.js': 'export const x = 1;\n' });
  const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), 'b3-toy');
  const withDelete = parseRules({ ...TOY_RULES, rules: [...TOY_RULES.rules, { from: 'pkg/src/old', to: null }] });
  applyLayout(root, [withDelete], { backupDir: backup });
  assert.equal(fs.readFileSync(path.join(backup, 'pkg/src/old/x.js'), 'utf8'), 'export const x = 1;\n');
  assert.equal(fs.readFileSync(path.join(backup, 'MANIFEST.txt'), 'utf8'), 'pkg/src/old/x.js\n');
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/old')), false);
});

test('a refused plan throws before anything moves; non-literal and broken imports are reported', () => {
  const root = toyRepo({ ...TOY, 'pkg/stray.js': 'export {};\n' });
  assert.throws(() => applyLayout(root, [rules]), /no rule covers pkg\/stray\.js/);
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/store.js')), true);
  const tricky = toyRepo({ ...TOY, 'pkg/src/ui/dyn.js': "import('./a' + name);\nimport './missing.js';\n" });
  const report = applyLayout(tricky, [rules]);
  assert.equal(report.nonLiteral[0].file, 'pkg/src/ui/dyn.js');
  assert.equal(report.unresolved[0].spec, './missing.js');
  const allowed = toyRepo({ ...TOY, 'pkg/src/ui/dyn.js': "import('./a' + name);\n" });
  assert.deepEqual(applyLayout(allowed, [rules], { allowNonLiteral: ['pkg/src/ui/dyn.js'] }).nonLiteral, []);
});

test('verifyTree names broken specifiers and leftovers; verifyDiff names a changed content line', () => {
  const root = toyRepo(TOY);
  assert.ok(verifyTree(root, [rules]).some(line => line.includes('still at its old location')));
  applyLayout(root, [rules], { commits: { moves: 'm', rewrites: 'r' } });
  const base = git(root, 'rev-parse', 'HEAD~2').trim();
  const moves = git(root, 'rev-parse', 'HEAD~1').trim();
  fs.appendFileSync(path.join(root, 'core/runtime/run.js'), 'export const sneaky = 2;\n');
  fs.writeFileSync(path.join(root, 'core/store.js'), fs.readFileSync(path.join(root, 'core/store.js'), 'utf8').replace('= run;', '= run + 1;'));
  fs.writeFileSync(path.join(root, 'core/store-parts/a.js'), "import { store } from '../nowhere.js';\nexport const a = store;\n");
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'edit');
  assert.ok(verifyTree(root, [rules]).some(line => line.includes('"../nowhere.js" resolves to no tracked file')));
  const diff = verifyDiff(root, base, moves);
  assert.ok(diff.problems.some(line => line.startsWith('core/store.js: content line changed')));
  assert.ok(diff.problems.some(line => line.startsWith('core/runtime/run.js')));
  assert.ok(verifyDiff(root, base, 'HEAD').problems.some(line => line.startsWith('the move commit is not a pure rename')));
});
