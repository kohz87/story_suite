import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI = path.resolve(import.meta.dirname, '../../scripts/codemap/cli.mjs');
const FILES = {
  'package.json': '{"type":"module"}\n',
  'docs/codemap/jobs.json': '{}\n',
  'docs/codemap/features-demo.json': '[{"name":"Main","entry":"src/a.js","about":"The a part."}]\n',
  'packages/demo/src/a.js': '// Does a.\nexport const a = 1;\n',
  'packages/demo/tests/a.test.js': "import { a } from '../src/a.js';\n",
};

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codemap-cli-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, text] of Object.entries(FILES)) put(dir, rel, text);
  return dir;
}
function put(dir, rel, text) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
}
function run(dir, mode) {
  const r = spawnSync('node', [CLI, mode], { env: { ...process.env, CODEMAP_ROOT: dir }, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}
const withRepo = fn => async () => {
  const dir = makeRepo();
  try { await fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('--check fails when a map is missing; --write creates the root and package maps; --check then passes', withRepo(dir => {
  const missing = run(dir, '--check');
  assert.equal(missing.status, 1);
  assert.match(missing.out, /docs\/codemap\.md is stale/);
  assert.match(missing.out, /docs\/codemap\/demo\.md is stale/);
  assert.equal(run(dir, '--write').status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'docs/codemap/demo.md')));
  const ok = run(dir, '--check');
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /docs\/codemap\/demo\.md demo 2 files/);
}));

test('--check fails when a package file changes after the map was written, and --write repairs it', withRepo(dir => {
  run(dir, '--write');
  put(dir, 'packages/demo/src/a.js', '// Does a.\nexport const a = 1;\nexport const b = 2;\n');
  const stale = run(dir, '--check');
  assert.equal(stale.status, 1);
  assert.match(stale.out, /docs\/codemap\/demo\.md is stale/);
  assert.equal(run(dir, '--write').status, 0);
  assert.equal(run(dir, '--check').status, 0);
}));

test('--check fails when a package test file is added or removed', withRepo(dir => {
  run(dir, '--write');
  put(dir, 'packages/demo/tests/extra.test.js', "import { a } from '../src/a.js';\n");
  assert.equal(run(dir, '--check').status, 1);
  run(dir, '--write');
  fs.rmSync(path.join(dir, 'packages/demo/tests/a.test.js'));
  assert.equal(run(dir, '--check').status, 1);
}));

test('a package file without a job fails even when its map is current', withRepo(dir => {
  put(dir, 'packages/demo/src/b.js', 'export const b = 1;\n');
  const written = run(dir, '--write');
  assert.equal(written.status, 1);
  assert.match(written.out, /packages\/demo\/src\/b\.js: no job sentence in docs\/codemap\/jobs-demo\.json/);
  put(dir, 'docs/codemap/jobs-demo.json', '{"src/b.js":"Holds b."}\n');
  assert.equal(run(dir, '--write').status, 0);
  assert.equal(run(dir, '--check').status, 0);
}));

test('an unknown mode prints usage and fails', () => {
  const r = spawnSync('node', [CLI, '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage/);
});
