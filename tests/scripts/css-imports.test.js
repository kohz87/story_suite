// The stylesheet import check: every @import reachable from the manifest's css names a file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cssImportProblems } from '../../scripts/checks/css-imports.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');

test('the shipped stylesheet tree has no missing @import', () => {
  assert.deepEqual(cssImportProblems(repoRoot, JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8')).css), []);
});

test('a wrong relative path, at any depth, is named; a comment and a remote url are not imports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-imports-'));
  try {
    fs.mkdirSync(path.join(dir, 'a/b'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'suite.css'), "@import url('./a/one.css');\n/* @import './gone.css'; */\n@import url('https://fonts.example/x.css');\n");
    fs.writeFileSync(path.join(dir, 'a/one.css'), "@import url('./b/two.css');\n@import url('../screens/missing.css');\n");
    fs.writeFileSync(path.join(dir, 'a/b/two.css'), 'x{}\n');
    assert.deepEqual(cssImportProblems(dir), ["a/one.css: @import '../screens/missing.css' names no file (screens/missing.css)"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
