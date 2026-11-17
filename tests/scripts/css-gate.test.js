import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { stylesheetRequests } from '../../scripts/release/css.mjs';
import { MAX_REQUESTS, checkRelease } from '../../scripts/release/check.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'css-gate-'));

test('local @imports left in a built suite.css are each counted, and enough of them fail the gate', async () => {
  const outRoot = tmp();
  try {
    const dir = path.join(outRoot, 'story-suite');
    await buildBundleSet(BUNDLE_SETS[0], dir, repoRoot);
    assert.equal(stylesheetRequests(dir, 'suite.css'), 1);
    const names = Array.from({ length: 10 }, (_, i) => `extra-${i}.css`);
    for (const name of names) fs.writeFileSync(path.join(dir, name), '.x{}');
    const css = fs.readFileSync(path.join(dir, 'suite.css'), 'utf8');
    fs.writeFileSync(path.join(dir, 'suite.css'), `${names.map(name => `@import "./${name}";`).join('\n')}\n${css}`);
    assert.equal(stylesheetRequests(dir, 'suite.css'), 11);
    assert.ok(stylesheetRequests(dir, 'suite.css') > 1);
    // checkRelease rebuilds, so the planted copy proves only the count; the gate's own limit is the same sum.
    assert.ok(8 + stylesheetRequests(dir, 'suite.css') > MAX_REQUESTS);
  } finally {
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
});

test('the gate fails when the manifest names a stylesheet and the build has none', async () => {
  const outRoot = tmp();
  const fake = tmp();
  try {
    fs.writeFileSync(path.join(fake, 'package.json'), JSON.stringify({ version: '0.1.0' }));
    fs.writeFileSync(path.join(fake, 'manifest.json'), JSON.stringify({ css: 'gone.css' }));
    fs.writeFileSync(path.join(fake, 'index.js'), 'export const a = 1;\n');
    const set = { name: 'fake', entries: ['index.js'], lazy: [], eager: [] };
    fs.writeFileSync(path.join(fake, 'package-lock.json'), JSON.stringify({ version: '0.1.0' }));
    execFileSync('git', ['init', '-q'], { cwd: fake });
    const gated = await checkRelease({ repoRoot: fake, outRoot, sets: [set] });
    assert.ok(gated.problems.some(problem => /names the stylesheet gone\.css and the build has none/.test(problem)), JSON.stringify(gated.problems));
  } finally {
    fs.rmSync(outRoot, { recursive: true, force: true });
    fs.rmSync(fake, { recursive: true, force: true });
  }
});
