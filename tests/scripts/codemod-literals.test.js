import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from '../../scripts/codemod/apply.mjs';
import { buildPlan, makeMapper } from '../../scripts/codemod/plan.mjs';
import { parseRules } from '../../scripts/codemod/rules.mjs';
import { rewriteStrings } from '../../scripts/codemod/rewrite-strings.mjs';
import { verifyDiff, verifyTree } from '../../scripts/codemod/verify.mjs';
import { git, toyRepo } from './codemod-toy.js';

const rules = parseRules({ area: 'l', scope: ['packages/pkg'], rules: [
  { from: 'packages/pkg/src/v2/store', to: 'core/store', stem: true },
  { from: 'packages/pkg/src/v2/ui', to: 'packages/pkg/ui' },
  { from: 'packages/pkg/src/v2/keep.js', to: 'packages/pkg/src/v2/keep.js' },
  { from: 'packages/pkg/src/gone', to: null },
] });
const files = new Set(['packages/pkg/src/v2/store.js', 'packages/pkg/src/v2/ui/a.js', 'packages/pkg/src/v2/keep.js', 'packages/pkg/src/gone/g.js']);
const mapper = makeMapper(buildPlan([...files], [rules]), [rules]);
const run = (source, oldFile, newFile) => rewriteStrings(source, { oldFile, newFile, files, mapper });

test('bare dot strings are separators, not paths: they are never rewritten', () => {
  const src = "const a = key.split('.');\nconst b = path.resolve(here, '..');\nconst c = './';\nconst d = '../';\nconst e = `${x}.`;\n";
  const out = run(src, 'packages/pkg/src/v2/store.js', 'core/store.js');
  assert.equal(out.source, src);
  assert.equal(out.changed, 0);
});

test('object keys are visited like values; prose keys are left', () => {
  const src = "export const t = { 'packages/pkg/src/v2/store.js': 1, '../keep.js': 2, 'a b/c': 3, plain: 'packages/pkg/src/v2/store.js' };\nclass K { 'packages/pkg/src/v2/store.js' = 1; }\n";
  const out = run(src, 'packages/pkg/src/v2/ui/a.js', 'packages/pkg/ui/a.js');
  assert.equal(out.source, "export const t = { 'core/store.js': 1, '../src/v2/keep.js': 2, 'a b/c': 3, plain: 'core/store.js' };\nclass K { 'core/store.js' = 1; }\n");
});

test('a package-relative string follows its target inside the package and is listed as stale when it cannot', () => {
  const src = "const inside = 'src/v2/ui/a.js';\nconst outside = 'src/v2/store.js';\nconst fine = 'src/v2/keep.js';\n";
  const out = run(src, 'packages/pkg/src/v2/keep.js', 'packages/pkg/src/v2/keep.js');
  assert.equal(out.source, "const inside = 'ui/a.js';\nconst outside = 'src/v2/store.js';\nconst fine = 'src/v2/keep.js';\n");
  assert.deepEqual(out.stale, ['src/v2/store.js']);
  const moved = run("const x = 'src/v2/keep.js';\nconst y = 'src/v2/ui/a.js';\n", 'packages/pkg/src/v2/store.js', 'core/store.js');
  assert.deepEqual(moved.stale, ['src/v2/ui/a.js']);
  assert.equal(moved.changed, 0);
});

const FILES = {
  'packages/pkg/src/v2/store.js': "export const parts = (key) => key.split('.');\nexport const up = '..';\nexport const stay = 'src/v2/store.js';\n",
  'packages/pkg/src/v2/keep.js': 'export const keep = 1;\n',
  'packages/pkg/src/v2/ui/a.js': 'export const a = 1;\n',
  'packages/pkg/src/gone/g.js': 'export const g = 1;\n',
};

test('apply leaves bare dots alone, reports a stale package string, and the verifier flags it and a hand-made folder path', () => {
  const root = toyRepo(FILES);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  const report = applyLayout(root, [rules], { backupDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), commits: { moves: 'm', rewrites: 'r' } });
  const text = fs.readFileSync(path.join(root, 'core/store.js'), 'utf8');
  assert.equal(text, FILES['packages/pkg/src/v2/store.js']);
  assert.deepEqual(report.stale, [{ file: 'packages/pkg/src/v2/store.js', value: 'src/v2/store.js' }]);
  const diff = verifyDiff(root, base, 'HEAD~1', 'HEAD', [rules]);
  assert.deepEqual(diff.problems, ['packages/pkg/src/v2/store.js: package-relative string "src/v2/store.js" would go stale']);
  // The old folder keeps keep.js, so only the string check can catch a separator turned into a folder path.
  fs.writeFileSync(path.join(root, 'core/store.js'), text.replace("split('.')", "split('../packages/pkg/src/v2')"));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'edit');
  const edited = verifyDiff(root, base, 'HEAD~2', 'HEAD', [rules]).problems;
  assert.ok(edited.includes('core/store.js: string "." became "../packages/pkg/src/v2", which is not a mapped path'));
});

test('verifyDiff flags a JS file deleted in the rewrite commit unless the plan deletes it; verifyTree flags a leftover', () => {
  const root = toyRepo({ ...FILES, 'packages/pkg/src/v2/ui/unused.js': 'export const u = 1;\n' });
  const base = git(root, 'rev-parse', 'HEAD').trim();
  applyLayout(root, [rules], { backupDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bk-')), commits: { moves: 'm', rewrites: 'r' } });
  fs.rmSync(path.join(root, 'packages/pkg/ui/unused.js'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'drop');
  const diff = verifyDiff(root, base, 'HEAD~2', 'HEAD', [rules]);
  assert.ok(diff.problems.includes('packages/pkg/ui/unused.js: deleted in the rewrite commit, but the plan does not delete it'));
  assert.ok(diff.dataEdits >= 1);
  fs.writeFileSync(path.join(root, 'packages/pkg/src/v2/other.js'), 'export const o = 1;\n');
  git(root, 'add', '-A');
  assert.deepEqual(verifyTree(root, [rules]).filter(line => line.includes('other')), ['packages/pkg/src/v2/other.js is still in a folder the rules cover and no rule moves it']);
});
