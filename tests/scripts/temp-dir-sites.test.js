import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const allowed = new Set(['scripts/temp-dir.mjs', 'tests/suite/qa/helpers/replay-diagnostics.js', 'tests/scripts/temp-dir-sites.test.js', 'tests/people/runtime-smoke.mjs']);

// A folder made straight under the OS temp dir is left behind when a run fails or is killed (17 Nov: /tmp ran out of inodes).
test('scripts and tests make temp folders through scripts/temp-dir.mjs, not mkdtemp(tmpdir())', () => {
  const files = execFileSync('git', ['ls-files', 'scripts', 'tests'], { cwd: repo, encoding: 'utf8' }).split('\n').filter(file => /\.(m?js)$/.test(file) && !allowed.has(file));
  const bad = files.filter(file => /mkdtemp(Sync)?\(/.test(fs.readFileSync(path.join(repo, file), 'utf8')));
  assert.deepEqual(bad, []);
});
