import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isCodeFile, isTestFile, listCodeFiles } from '../../scripts/checks/code-files.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

test('every text file is checked: source, styles, scripts, html and unknown languages', () => {
  for (const p of ['core/a.js', 'x/b.mjs', 'c.cjs', 'ui/s.css', 'a/b.ts', 'scripts/ci/x.sh', 'tests/probe.py', 'x/y.pl', 'x/z.rb', 'ui/i.html', 'a/b.jsx', 'a/c.cts', 'scripts/x.bash']) assert.equal(isCodeFile(p), true, p);
});

test('extensionless files and dotfiles are checked', () => {
  for (const p of ['scripts/run', 'bin/tool', 'Makefile', '.gitignore']) assert.equal(isCodeFile(p), true, p);
});

test('licence texts are legal data, not code', () => {
  for (const p of ['LICENSE', 'packages/a/LICENSE', 'COPYING', 'NOTICE.txt', 'LICENSE.md', 'LICENSE.txt', 'COPYING.md', 'NOTICE', 'NOTICE.md', 'x/y/LICENSE.txt']) assert.equal(isCodeFile(p), false, p);
});

test('a licence-looking name with any other extension is code', () => {
  for (const p of ['core/LICENSE.js', 'LICENSE.mjs', 'COPYING.sh', 'NOTICE.py', 'LICENSE.txt.js', 'LICENSE-x', 'my/NOTICE.cjs']) assert.equal(isCodeFile(p), true, p);
});

test('workflow YAML is checked; other YAML is data', () => {
  for (const p of ['.github/workflows/ci.yml', '.github/workflows/x.yaml', '.github/actions/setup/action.yml', '.github/actions/a/b/action.yaml', '.github/dependabot.yml']) assert.equal(isCodeFile(p), true, p);
  for (const p of ['data/a.yml', 'docs/b.yaml', 'packages/x/.github/workflows/a.yml', 'packages/x/.github-workflows/a.yml']) assert.equal(isCodeFile(p), false, p);
});

test('data and asset files are not checked', () => {
  const exts = 'json jsonl md txt csv lock svg png jpg jpeg webp gif ico woff woff2 ttf gz zip map'.split(' ');
  for (const e of exts) assert.equal(isCodeFile(`data/file.${e}`), false, e);
  for (const p of ['package-lock.json', 'docs/history/commit-map-sb.txt', 'a.js.map', 'DATA.JSON']) assert.equal(isCodeFile(p), false, p);
});

test('vendored copies, node_modules and data files are not checked', () => {
  for (const p of [
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

test('symlinks and data-extension binaries are skipped when listing; a NUL in any other file keeps it listed', () => {
  const root = tempDir('cf-');
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    fs.writeFileSync(path.join(root, 'img.png'), Buffer.from([1, 2, 0, 3]));
    fs.writeFileSync(path.join(root, 'tool.pl'), 'print 1;\n');
    fs.writeFileSync(path.join(root, 'RUN'), 'x\n');
    fs.writeFileSync(path.join(root, 'nul.mjs'), Buffer.from('/*\0*/\nexport const a = 1;\n'));
    fs.writeFileSync(path.join(root, 'bin.dat'), Buffer.from([1, 2, 0, 3]));
    fs.symlinkSync('tool.pl', path.join(root, 'link.pl'));
    assert.deepEqual(listCodeFiles(root), ['RUN', 'bin.dat', 'nul.mjs', 'tool.pl']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
