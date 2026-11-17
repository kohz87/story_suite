import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { buildBundleSet } from '../../scripts/release/bundle.mjs';
import { stylesheetRequests } from '../../scripts/release/css.mjs';
import { MAX_REQUESTS, checkRelease } from '../../scripts/release/check.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const tmp = () => tempDir('css-gate-');

test('local @imports left in a built suite.css are each counted, and enough of them fail the real gate', async () => {
  const outRoot = tmp();
  try {
    const dir = path.join(outRoot, 'story-suite');
    await buildBundleSet(BUNDLE_SETS[0], dir, repoRoot);
    assert.equal(stylesheetRequests(dir, 'suite.css'), 1);
    const plant = (outDir) => {
      const names = Array.from({ length: 10 }, (_, i) => `extra-${i}.css`);
      for (const name of names) fs.writeFileSync(path.join(outDir, name), '.x{}');
      const css = fs.readFileSync(path.join(outDir, 'suite.css'), 'utf8');
      fs.writeFileSync(path.join(outDir, 'suite.css'), `${names.map(name => `@import "./${name}";`).join('\n')}\n${css}`);
    };
    const clean = await checkRelease({ repoRoot, outRoot, sets: [BUNDLE_SETS[0]] });
    assert.ok(!clean.problems.some(problem => /requests at load/.test(problem)), JSON.stringify(clean.problems));
    const planted = await checkRelease({ repoRoot, outRoot, sets: [BUNDLE_SETS[0]], afterBuild: plant });
    assert.ok(planted.problems.some(problem => problem.includes(`requests at load, the limit is ${MAX_REQUESTS}`)), JSON.stringify(planted.problems));
    assert.ok(planted.rows[0].requests > clean.rows[0].requests + 9);
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
