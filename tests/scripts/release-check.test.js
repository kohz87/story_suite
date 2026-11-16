import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { BUNDLE_SETS } from '../../scripts/release/entries.mjs';
import { MAX_REQUESTS, RELEASE_VERSION, checkRelease } from '../../scripts/release/check.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
let outRoot;
let result;
before(async () => {
  outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  result = await checkRelease({ repoRoot, outRoot });
});
after(() => fs.rmSync(outRoot, { recursive: true, force: true }));

test('the release gate is green on this tree: version 0.1.0, no tag, every set builds', () => {
  assert.equal(RELEASE_VERSION, '0.1.0');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.rows.map(row => row.name), BUNDLE_SETS.map(set => set.name));
});

test('each extension loads in at most ten requests when bundled', () => {
  for (const row of result.rows) assert.ok(row.requests >= 1 && row.requests <= MAX_REQUESTS, `${row.name}: ${row.requests}`);
});

test('the People part starts with the entry, so it is packed into it and is not a chunk of its own', () => {
  const files = fs.readdirSync(path.join(outRoot, 'story-suite'));
  assert.deepEqual(files.filter(file => /^bootstrap-.*\.js$/.test(file)), [], 'no People chunk to fetch at start');
  assert.match(fs.readFileSync(path.join(outRoot, 'story-suite/index.js'), 'utf8'), /startPeople/);
});

test('building the real packages twice gives byte-identical files', async () => {
  const again = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  try {
    await checkRelease({ repoRoot, outRoot: again });
    for (const set of BUNDLE_SETS) {
      for (const file of fs.readdirSync(path.join(outRoot, set.name))) {
        assert.ok(fs.readFileSync(path.join(outRoot, set.name, file)).equals(fs.readFileSync(path.join(again, set.name, file))), `${set.name}/${file}`);
      }
    }
  } finally {
    fs.rmSync(again, { recursive: true, force: true });
  }
});

function fakeRepo(version, tags) {
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'release-fake-'));
  fs.writeFileSync(path.join(fake, 'package.json'), JSON.stringify({ version }));
  fs.writeFileSync(path.join(fake, 'package-lock.json'), JSON.stringify({ version }));
  const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: fake, stdio: 'ignore' });
  git('init', '-q');
  git('add', '.');
  git('commit', '-q', '-m', 'x');
  for (const tag of tags) git('tag', tag);
  return fake;
}

test('the gate names a version other than 0.1.0', async () => {
  const fake = fakeRepo('9.9.9', []);
  try {
    const { problems } = await checkRelease({ repoRoot: fake, outRoot: path.join(fake, 'out'), sets: [] });
    assert.deepEqual(problems, ['package.json version is 9.9.9, the release is 0.1.0']);
  } finally {
    fs.rmSync(fake, { recursive: true, force: true });
  }
});

test('the gate refuses a tag for exactly 0.1.0 and ignores tags that only contain the digits', async () => {
  const fake = fakeRepo('0.1.0', ['v10.1.0', 'sb-v2.10.1.0', 'sb-v0.1.0', 'v0.1.0', '0.1.0']);
  try {
    const { problems } = await checkRelease({ repoRoot: fake, outRoot: path.join(fake, 'out'), sets: [] });
    assert.deepEqual(problems, ['releases are not tagged; found tag 0.1.0, sb-v0.1.0, v0.1.0']);
  } finally {
    fs.rmSync(fake, { recursive: true, force: true });
  }
});

test('the gate names a lock file whose version differs from package.json', async () => {
  const fake = fakeRepo('0.1.0', []);
  fs.writeFileSync(path.join(fake, 'package-lock.json'), JSON.stringify({ version: '0.0.0' }));
  try {
    const { problems } = await checkRelease({ repoRoot: fake, outRoot: path.join(fake, 'out'), sets: [] });
    assert.deepEqual(problems, ['package-lock.json version is 0.0.0, package.json says 0.1.0']);
  } finally {
    fs.rmSync(fake, { recursive: true, force: true });
  }
});
