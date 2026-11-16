import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, '../../scripts/sync-redraw-copy.mjs');

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'redraw-copy-'));
  fs.mkdirSync(path.join(dir, 'ui/runtime'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ui/runtime/redraw.js'), 'export const a = 1;\n');
  return dir;
}
function run(dir, ...args) {
  const r = spawnSync('node', [SCRIPT, ...args], { env: { ...process.env, SYNC_REDRAW_ROOT: dir }, encoding: 'utf8' });
  return r.status;
}
const copy = dir => path.join(dir, 'packages/story-block/src/v2/shared/redraw.js');

test('a missing copy fails the check', () => {
  assert.equal(run(makeRoot(), '--check'), 1);
});

test('a fresh copy passes and has the header', () => {
  const dir = makeRoot();
  assert.equal(run(dir), 0);
  assert.equal(run(dir, '--check'), 0);
  const text = fs.readFileSync(copy(dir), 'utf8');
  assert.ok(text.startsWith('// generated from ui/runtime/redraw.js; do not edit.\n'));
});

test('a hand edit or a changed source fails the check', () => {
  const dir = makeRoot();
  run(dir);
  fs.appendFileSync(copy(dir), '// hand edit\n');
  assert.equal(run(dir, '--check'), 1);
  run(dir);
  fs.writeFileSync(path.join(dir, 'ui/runtime/redraw.js'), 'export const a = 2;\n');
  assert.equal(run(dir, '--check'), 1);
});

test('a checkout that has the copy at its layout-mapped home is checked there, and a stale one fails', () => {
  const dir = makeRoot();
  const moved = path.join(dir, 'ui/legacy/shared/redraw.js');
  fs.mkdirSync(path.dirname(moved), { recursive: true });
  fs.writeFileSync(moved, '// generated from ui/runtime/redraw.js; do not edit.\nexport const a = 1;\n');
  assert.equal(run(dir, '--check'), 0);
  fs.writeFileSync(moved, 'export const a = 2;\n');
  assert.equal(run(dir, '--check'), 1);
  assert.equal(run(dir), 0);
  assert.equal(fs.existsSync(copy(dir)), false);
  assert.equal(run(dir, '--check'), 0);
});
