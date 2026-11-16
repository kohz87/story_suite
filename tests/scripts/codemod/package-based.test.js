import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, makeMapper } from '../../../scripts/codemod/plan.mjs';
import { parseRules } from '../../../scripts/codemod/rules.mjs';
import { rewriteStrings } from '../../../scripts/codemod/rewrite-strings.mjs';
import { verifyDiff } from '../../../scripts/codemod/verify.mjs';
import { applyLayout } from '../../../scripts/codemod/apply.mjs';
import { git, toyRepo } from '../codemod-toy.js';
import fs from 'node:fs';
import path from 'node:path';

const rules = parseRules({ area: 'p', scope: ['packages/story-block'], rules: [
  { from: 'core/store', to: 'core/store', stem: true },
  { from: 'tests/helpers', to: 'tests/helpers' },
  { from: 'packages/story-block/tests/other', to: 'tests/other' },
] });
const files = new Set(['core/store.js', 'tests/helpers/split-source.js', 'packages/story-block/tests/other/x.js']);
const mapper = makeMapper(buildPlan([...files], [rules]), [rules]);
const run = (oldFile, newFile) => rewriteStrings("export const f = 'src/v2/store.js';\n", { oldFile, newFile, files, mapper });

test('a listed package-based file keeps reading against its package: the string climbs out of it', () => {
  const out = run('tests/helpers/split-source.js', 'tests/helpers/split-source.js');
  assert.equal(out.source, "export const f = '../../core/store.js';\n");
  assert.deepEqual(out.stale, []);
});

test('any other file that leaves its package lists the string as stale and leaves it', () => {
  const out = run('packages/story-block/tests/other/x.js', 'tests/other/x.js');
  assert.equal(out.source, "export const f = 'src/v2/store.js';\n");
  assert.deepEqual(out.stale, ['src/v2/store.js']);
});

const PKG_FILES = {
  'core/store.js': 'export const s = 1;\n',
  'packages/story-block/tests/other/x.js': "export const f = 'src/v2/store.js';\n",
  'tests/helpers/split-source.js': "export const f = 'src/v2/store.js';\n",
};

// Applies the rules, then commits `text` over the moved file as a hand edit and returns verify's mapped-path problems.
function editedProblems(moved, text) {
  const root = toyRepo(PKG_FILES);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  applyLayout(root, [rules], { commits: { moves: 'm', rewrites: 'r' } });
  fs.writeFileSync(path.join(root, moved), text);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '--allow-empty', '-m', 'edit');
  return verifyDiff(root, base, 'HEAD~2', 'HEAD', [rules]).problems.filter(line => line.startsWith(moved) && /mapped path|content line/.test(line));
}

test('verifyDiff accepts a listed file\'s package string that climbs to the mapped place and flags one that climbs elsewhere', () => {
  const file = 'tests/helpers/split-source.js';
  assert.deepEqual(editedProblems(file, "export const f = '../../core/store.js';\n"), []);
  assert.equal(editedProblems(file, "export const f = '../../core/elsewhere.js';\n").length, 1);
});

test('verifyDiff flags the same climb in a file the rewriter does not treat as package-based', () => {
  assert.equal(editedProblems('tests/other/x.js', "export const f = '../../core/store.js';\n").length, 1);
});
