import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRelease } from '../../scripts/release/check.mjs';
import { readVersions, versionProblems, writeVersions } from '../../scripts/release/versions.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const files = {
  'package.json': '{\n  "name": "x",\n  "version": "0.1.0"\n}\n',
  'package-lock.json': '{\n  "version": "0.1.0",\n  "packages": { "": { "version": "0.1.0" } }\n}\n',
  'manifest.json': '{\n    "version": "0.1.0",\n    "js": "index.js"\n}\n',
  'core/version.js': "// banner\nexport const SUITE_VERSION = '0.1.0';\n",
  'README.md': '# Story Suite 0.1.0\n\ntext 9.9.9 stays\n',
  'CHANGELOG.md': '# Changelog\n\n## 0.1.0\n\n- first\n\n## 0.0.9\n',
};
function fake(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-versions-'));
  for (const [name, text] of Object.entries({ ...files, ...overrides })) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8');

test('every place agrees on the real tree', () => {
  const rows = readVersions(root);
  assert.ok(rows.some(row => row.file === 'README.md') && rows.some(row => row.file === 'CHANGELOG.md') && rows.some(row => row.file === 'core/version.js'));
  assert.deepEqual(versionProblems(root, '0.1.0'), []);
});

test('one disagreeing place is named, whichever it is', () => {
  const dir = fake({ 'README.md': '# Story Suite 0.2.0\n', 'core/version.js': "export const SUITE_VERSION = '0.0.1';\n", 'CHANGELOG.md': '# Changelog\n\nnothing\n' });
  try {
    assert.deepEqual(versionProblems(dir, '0.1.0'), [
      'core/version.js version is 0.0.1, package.json says 0.1.0',
      'README.md version is 0.2.0, package.json says 0.1.0',
      'CHANGELOG.md version is missing, package.json says 0.1.0',
    ]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the release gate fails on a disagreeing place (and is the one that reports it)', async () => {
  const dir = fake({ 'manifest.json': '{ "version": "0.3.0" }\n' });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  try {
    const { problems } = await checkRelease({ repoRoot: dir, outRoot: path.join(dir, 'out'), sets: [] });
    assert.deepEqual(problems, ['manifest.json version is 0.3.0, package.json says 0.1.0']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('writing a version changes the version line of every place and nothing else', () => {
  const dir = fake();
  try {
    writeVersions(dir, '0.2.0');
    assert.deepEqual(versionProblems(dir, '0.2.0'), []);
    assert.equal(read(dir, 'README.md'), '# Story Suite 0.2.0\n\ntext 9.9.9 stays\n');
    assert.equal(read(dir, 'CHANGELOG.md'), '# Changelog\n\n## 0.2.0\n\n- first\n\n## 0.0.9\n');
    assert.equal(read(dir, 'core/version.js'), "// banner\nexport const SUITE_VERSION = '0.2.0';\n");
    assert.equal(JSON.parse(read(dir, 'package-lock.json')).packages[''].version, '0.2.0');
    assert.equal(read(dir, 'manifest.json'), '{\n    "version": "0.2.0",\n    "js": "index.js"\n}\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed version and a place with no version line are refused before anything is written', () => {
  const dir = fake({ 'README.md': 'no title\n' });
  try {
    assert.throws(() => writeVersions(dir, 'v1'), /not a version/);
    assert.throws(() => writeVersions(dir, '0.2.0'), /README\.md has no version line/);
    assert.equal(JSON.parse(read(dir, 'package.json')).version, '0.1.0');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
