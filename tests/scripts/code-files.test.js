import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isCodeFile, isTestFile, listCodeFiles } from '../../scripts/checks/code-files.mjs';

test('every text file is checked: source, styles, scripts, html and unknown languages', () => {
  for (const p of ['core/a.js', 'x/b.mjs', 'c.cjs', 'ui/s.css', 'a/b.ts', 'scripts/ci/x.sh', 'tests/probe.py', 'x/y.pl', 'x/z.rb', 'ui/i.html', 'a/b.jsx', 'a/c.cts', 'scripts/x.bash']) assert.equal(isCodeFile(p), true, p);
});

test('extensionless files and dotfiles are checked', () => {
  for (const p of ['scripts/run', 'bin/tool', 'Makefile', '.gitignore']) assert.equal(isCodeFile(p), true, p);
});

test('licence texts are legal data, not code', () => {
  for (const p of ['LICENSE', 'packages/a/LICENSE', 'COPYING', 'NOTICE.txt']) assert.equal(isCodeFile(p), false, p);
});

test('data and asset files are not checked', () => {
  const exts = 'json jsonl md txt csv yml yaml lock svg png jpg jpeg webp gif ico woff woff2 ttf gz zip map'.split(' ');
  for (const e of exts) assert.equal(isCodeFile(`data/file.${e}`), false, e);
  for (const p of ['package-lock.json', 'docs/history/commit-map-sb.txt', 'a.js.map', 'DATA.JSON']) assert.equal(isCodeFile(p), false, p);
});

test('vendored copies, node_modules and data files are not checked', () => {
  for (const p of [
    'packages/story-director/tests/vendor/story-block/src/v2/store.js',
    'packages/x/vendor/lib.js',
    'packages/npc-state-delta/tests/fixtures/big.json',
    'node_modules/a/index.js',
    'packages/a/node_modules/b.js',
  ]) assert.equal(isCodeFile(p), false, p);
});

test('code under fixtures is checked, data under fixtures is not', () => {
  assert.equal(isCodeFile('packages/a/tests/fixtures/helper.js'), true);
  assert.equal(isCodeFile('packages/a/tests/fixtures/data.json'), false);
});

test('test files: under a tests/ or test/ folder, or named *.test.*', () => {
  for (const p of ['tests/scripts/a.test.js', 'packages/a/tests/helper.mjs', 'test/x.js', 'core/y.test.mjs']) assert.equal(isTestFile(p), true, p);
  for (const p of ['core/tests.js', 'scripts/latest/a.js', 'core/a.js']) assert.equal(isTestFile(p), false, p);
});

test('binary files and symlinks are skipped when listing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    fs.writeFileSync(path.join(root, 'bin.dat'), Buffer.from([1, 2, 0, 3]));
    fs.writeFileSync(path.join(root, 'tool.pl'), 'print 1;\n');
    fs.writeFileSync(path.join(root, 'RUN'), 'x\n');
    fs.symlinkSync('tool.pl', path.join(root, 'link.pl'));
    assert.deepEqual(listCodeFiles(root), ['RUN', 'tool.pl']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
