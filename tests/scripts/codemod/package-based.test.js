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
  { from: 'packages/story-block/src/v2/store', to: 'core/store', stem: true },
  { from: 'packages/story-block/tests/helpers', to: 'tests/helpers' },
  { from: 'packages/story-block/tests/other', to: 'tests/other' },
] });
const files = new Set(['packages/story-block/src/v2/store.js', 'packages/story-block/tests/helpers/split-source.js', 'packages/story-block/tests/other/x.js']);
const mapper = makeMapper(buildPlan([...files], [rules]), [rules]);
const run = (oldFile, newFile) => rewriteStrings("export const f = 'src/v2/store.js';\n", { oldFile, newFile, files, mapper });

test('a listed package-based file keeps reading against its package: the string climbs out of it', () => {
  const out = run('packages/story-block/tests/helpers/split-source.js', 'tests/helpers/split-source.js');
  assert.equal(out.source, "export const f = '../../core/store.js';\n");
  assert.deepEqual(out.stale, []);
});

test('any other file that leaves its package lists the string as stale and leaves it', () => {
  const out = run('packages/story-block/tests/other/x.js', 'tests/other/x.js');
  assert.equal(out.source, "export const f = 'src/v2/store.js';\n");
  assert.deepEqual(out.stale, ['src/v2/store.js']);
});

test('verifyDiff accepts a package string that climbs to the mapped place and flags one that climbs elsewhere', () => {
  const root = toyRepo({
    'packages/story-block/src/v2/store.js': 'export const s = 1;\n',
    'packages/story-block/tests/other/x.js': "export const f = 'src/v2/store.js';\n",
  });
  const base = git(root, 'rev-parse', 'HEAD').trim();
  applyLayout(root, [rules], { commits: { moves: 'm', rewrites: 'r' } });
  const edit = text => { fs.writeFileSync(path.join(root, 'tests/other/x.js'), text); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'edit'); };
  edit("export const f = '../../core/store.js';\n");
  assert.deepEqual(verifyDiff(root, base, 'HEAD~2', 'HEAD', [rules]).problems.filter(line => /mapped path|content line/.test(line)), []);
  edit("export const f = '../../core/elsewhere.js';\n");
  assert.ok(verifyDiff(root, base, 'HEAD~3', 'HEAD', [rules]).problems.some(line => line.includes('not a mapped path')));
});
