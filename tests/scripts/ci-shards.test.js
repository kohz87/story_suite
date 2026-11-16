import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const ci = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');

// The text of one job in ci.yml (jobs sit at two-space indent).
function job(name) {
  const body = ci.slice(ci.indexOf('\njobs:\n') + 6);
  const parts = body.split(/^  ([a-z][\w-]*):\n/m);
  const at = parts.indexOf(name);
  assert.ok(at > 0, `job ${name} missing`);
  return parts[at + 1];
}
const jobNames = () => [...ci.slice(ci.indexOf('\njobs:\n')).matchAll(/^  ([a-z][\w-]*):\n/gm)].map((m) => m[1]);
const shardsOf = (text) => JSON.parse(text.match(/^ {8}shard: (\[.*\])$/m)[1]);

// Every shard "i/N" of one job: N is the same everywhere and i runs 1..N once each, so the shards together cover
// every test file (node --test-shard hands each file to exactly one shard).
function assertCompleteShards(name) {
  const shards = shardsOf(job(name));
  const total = shards.length;
  assert.ok(total >= 2 && total <= 3, `${name} should have 2 or 3 shards`);
  assert.deepEqual(shards, Array.from({ length: total }, (_, i) => `${i + 1}/${total}`));
  return total;
}

test('modules runs its tests in complete, non-overlapping shards that keep the test:modules globs', () => {
  assertCompleteShards('modules');
  const text = job('modules');
  const script = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['test:modules'];
  const globs = script.match(/"[^"]+"/g).slice(1);
  assert.ok(globs.length >= 5, 'test:modules names its test folders');
  assert.ok(text.includes(`--test-shard=\${{ matrix.shard }} ${globs.join(' ')}\n`));
  assert.ok(!text.includes('--test-force-exit'));
});

test('the suite runs in complete shards and verify adds up exactly that many count files', () => {
  const total = assertCompleteShards('suite');
  assert.match(job('suite'), /SUITE_SHARD: \$\{\{ matrix\.shard \}\}/);
  assert.match(job('verify'), new RegExp(`suite-floor\\.sh ${total} `));
});

test('verify needs every job that is not informational and always runs', () => {
  const text = job('verify');
  const needs = text.match(/^ {4}needs: \[(.*)\]$/m)[1].split(',').map((s) => s.trim());
  // An informational job (continue-on-error: true, e.g. layout-dry-run) must not block the gate.
  const informational = jobNames().filter((n) => /^ {4}continue-on-error: true$/m.test(job(n)));
  const required = jobNames().filter((n) => n !== 'verify' && !informational.includes(n));
  assert.deepEqual([...needs].sort(), required.sort());
  assert.match(text, /^ {4}if: \$\{\{ always\(\) \}\}$/m);
  assert.match(text, /\[ "\$r" = success \]/);
});

test('node --test-shard runs every test file once across the shards', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-shards-'));
  try {
    const files = Array.from({ length: 8 }, (_, i) => `f${i}.test.js`);
    for (const f of files) fs.writeFileSync(path.join(dir, f), `import { test } from 'node:test';\ntest('${f}', () => {});\n`);
    const seen = [];
    for (const total of [2, 3]) {
      const ran = [];
      for (let i = 1; i <= total; i++) {
        const r = spawnSync(process.execPath, ['--test', `--test-shard=${i}/${total}`, '--test-reporter=tap', ...files], { cwd: dir, encoding: 'utf8', timeout: 60000, env: { ...process.env, NODE_TEST_CONTEXT: undefined } });
        assert.equal(r.status, 0, r.stdout + r.stderr);
        ran.push(...[...r.stdout.matchAll(/^ok \d+ - (f\d\.test\.js)$/gm)].map((m) => m[1]));
      }
      seen.push(ran.sort());
    }
    assert.deepEqual(seen[0], files);
    assert.deepEqual(seen[1], files);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a suite shard with no count file fails instead of skipping the floor', () => {
  const r = spawnSync('bash', [path.join(root, 'scripts/ci/suite-tests.sh')], { encoding: 'utf8', env: { ...process.env, SUITE_SHARD: '1/2', SUITE_COUNT_FILE: '' } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /SUITE_COUNT_FILE must be set/);
});

test('suite-floor.sh sums the shards against the floor in suite-tests.sh', () => {
  const min = Number(fs.readFileSync(path.join(root, 'scripts/ci/suite-tests.sh'), 'utf8').match(/^MIN_TESTS=(\d+)/m)[1]);
  const run = (counts, shards) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-floor-'));
    try {
      counts.forEach((c, i) => fs.writeFileSync(path.join(dir, `c${i}.txt`), `${c}\n`));
      return spawnSync('bash', [path.join(root, 'scripts/ci/suite-floor.sh'), String(shards), dir], { encoding: 'utf8' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  assert.equal(run([min - 100, 100], 2).status, 0);
  assert.equal(run([min - 101, 100], 2).status, 1, 'a sum below the floor must fail');
  assert.equal(run([min], 2).status, 1, 'a missing shard must fail');
  assert.equal(run([min, 'x'], 2).status, 1, 'a bad count must fail');
});
