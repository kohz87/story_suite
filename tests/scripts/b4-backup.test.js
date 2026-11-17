import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupFiles, manifestText } from '../../scripts/b4/backup.mjs';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b4-backup-'));
  fs.mkdirSync(path.join(root, 'a/b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a/b/x.js'), 'one\ntwo\n');
  fs.writeFileSync(path.join(root, 'a/y.js'), 'solo');
  return root;
}

test('copies files to the same relative paths and writes a manifest with sha256', t => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dest = path.join(root, '_out/unit1');
  const entries = backupFiles({ root, dest, unit: 'unit1', paths: ['a/y.js', 'a/b/x.js'], commitOf: () => 'abc123' });
  assert.equal(fs.readFileSync(path.join(dest, 'a/b/x.js'), 'utf8'), 'one\ntwo\n');
  const manifest = fs.readFileSync(path.join(dest, 'MANIFEST.txt'), 'utf8');
  assert.match(manifest, new RegExp(`${createHash('sha256').update('one\ntwo\n').digest('hex')}  8  2  abc123  a/b/x\\.js`));
  assert.match(manifest, /  4  1  abc123  a\/y\.js/);
  assert.deepEqual(entries.map(e => e.path), ['a/b/x.js', 'a/y.js']);
});

test('refuses when the target exists, and leaves it untouched', t => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dest = path.join(root, '_out/u');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'keep.txt'), 'old');
  assert.throws(() => backupFiles({ root, dest, unit: 'u', paths: ['a/y.js'] }), /already exists/);
  assert.deepEqual(fs.readdirSync(dest), ['keep.txt']);
});

test('refuses a missing file, a directory, an absolute path and a path outside the repo before writing anything', t => {
  const root = repo();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const bad of ['a/nope.js', 'a', '/etc/passwd', '../x.js']) {
    const dest = path.join(root, '_out/bad');
    assert.throws(() => backupFiles({ root, dest, unit: 'bad', paths: ['a/y.js', bad] }), /backup:/);
    assert.equal(fs.existsSync(dest), false, bad);
  }
  assert.throws(() => backupFiles({ root, dest: path.join(root, '_o'), unit: 'u', paths: [] }), /no paths/);
});

test('manifestText has a header and one row per entry', () => {
  const text = manifestText('u', [{ path: 'p.js', sha256: 'ff', bytes: 1, lines: 1, commit: '' }]);
  assert.equal(text, '# backup of 1 files for u: sha256, bytes, lines, last commit, path\nff  1  1  -  p.js\n');
});
