import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { removedExportProblems, removedNames } from '../../scripts/checks/removed-exports.mjs';

test('the list skips comments and blank lines', () => {
  assert.deepEqual(removedNames('# why\n\ncreateParticipant\n  memoryVault  \n'), ['createParticipant', 'memoryVault']);
});

test('a removed name used as a word is a problem; a longer name that only contains it is not', () => {
  const names = ['memoryVault'];
  assert.deepEqual(removedExportProblems(names, [{ path: 'a.js', text: 'import { memoryVault } from "./x.js";' }]), ['a.js: memoryVault was removed (docs/merge/removed-exports.txt)']);
  assert.deepEqual(removedExportProblems(names, [{ path: 'b.js', text: 'const memoryVaultLike = 1; const x_memoryVault2 = 2;' }]), []);
  assert.deepEqual(removedExportProblems([], [{ path: 'c.js', text: 'memoryVault' }]), []);
});

test('the real tree uses none of the removed names (the script exits 0)', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  execFileSync(process.execPath, [path.join(root, 'scripts/checks/removed-exports.mjs')], { cwd: root, stdio: 'pipe' });
});
