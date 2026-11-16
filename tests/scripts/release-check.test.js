import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { MAX_REQUESTS, RELEASE_VERSION, checkRelease } from '../../scripts/release/check.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
let result;
before(async () => { result = await checkRelease({ repoRoot, outRoot }); });

test('the release gate is green on this tree: version 0.1.0, no tag, every set builds', () => {
  assert.equal(RELEASE_VERSION, '0.1.0');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.rows.map(row => row.name), BUNDLE_SETS.map(set => set.name));
});

test('each extension loads in at most ten requests when bundled', () => {
  for (const row of result.rows) assert.ok(row.requests >= 1 && row.requests <= MAX_REQUESTS, `${row.name}: ${row.requests}`);
});

test('building the real packages twice gives byte-identical files', async () => {
  const again = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  await checkRelease({ repoRoot, outRoot: again });
  for (const set of BUNDLE_SETS) {
    for (const file of fs.readdirSync(path.join(outRoot, set.name))) {
      assert.ok(fs.readFileSync(path.join(outRoot, set.name, file)).equals(fs.readFileSync(path.join(again, set.name, file))), `${set.name}/${file}`);
    }
  }
  fs.rmSync(again, { recursive: true, force: true });
});

test('the gate names a version other than 0.1.0', async () => {
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'release-fake-'));
  fs.writeFileSync(path.join(fake, 'package.json'), '{"version":"9.9.9"}');
  const { execFileSync } = await import('node:child_process');
  execFileSync('git', ['init', '-q'], { cwd: fake });
  const { problems } = await checkRelease({ repoRoot: fake, outRoot: path.join(fake, 'out'), sets: [] });
  assert.deepEqual(problems, ['package.json version is 9.9.9, the release is 0.1.0']);
  fs.rmSync(fake, { recursive: true, force: true });
});
