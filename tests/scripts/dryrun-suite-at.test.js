import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { suiteAt } from '../../scripts/dryrun/suite-at.mjs';

// The dry-run compares a checkout from before the move with one from after it: the same name is found in either.
let tmp;
const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const suiteOf = root => {
  const sb = path.join(root, 'packages/story-block');
  return { roots: { sb }, at: rel => import(path.join(sb, rel)) };
};

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dryrun-suite-at-'));
  put(path.join(tmp, 'before'), 'packages/story-block/src/v2/store.js', "export const where = 'old layout';\n");
  put(path.join(tmp, 'after'), 'core/store.js', "export const where = 'new layout';\n");
  put(path.join(tmp, 'after'), 'packages/story-block/src/v2/keep.js', "export const where = 'not moved';\n");
  fs.mkdirSync(path.join(tmp, 'after/packages/story-block'), { recursive: true });
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('a checkout of the old layout answers from the old path', async () => {
  assert.equal((await suiteAt(suiteOf(path.join(tmp, 'before')), 'src/v2/store.js')).where, 'old layout');
});

test('a checkout of the new layout answers from the layout-mapped path, and a file that did not move from its own', async () => {
  const suite = suiteOf(path.join(tmp, 'after'));
  assert.equal((await suiteAt(suite, 'src/v2/store.js')).where, 'new layout');
  assert.equal((await suiteAt(suite, 'src/v2/keep.js')).where, 'not moved');
});

test('a file neither layout has fails the way suite.at does (the card text then answers null)', async () => {
  await assert.rejects(suiteAt(suiteOf(path.join(tmp, 'after')), 'src/v2/nothing.js'));
});
