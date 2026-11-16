import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unrunRootTests, unrunTests } from '../../scripts/checks/package-test-globs.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
// The shape of NPC State's old package test script (its package.json is gone): an unquoted shell glob and one nested level.
const nsdScript = 'node --max-old-space-size=4096 --import ./tests/active-runtime-test-setup.mjs --test tests/*.test.js tests/v2/break/*.test.js';

function pkg(script, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptg-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: script } }));
  for (const rel of files) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), '\n');
  }
  return dir;
}

test('every real package runs all of its test files', () => {
  for (const name of (fs.existsSync(path.join(repo, 'packages')) ? fs.readdirSync(path.join(repo, 'packages')) : []).filter(one => fs.existsSync(path.join(repo, 'packages', one, 'package.json')))) {
    assert.deepEqual(unrunTests(path.join(repo, 'packages', name)), [], name);
  }
});

test('a nested test the NSD globs miss is an error; the matched ones are not', () => {
  const dir = pkg(nsdScript, ['tests/a.test.js', 'tests/v2/break/b.test.js', 'tests/v2/break/nested/new.test.js', 'tests/helper.js']);
  try {
    assert.deepEqual(unrunTests(dir, 'npc-state-delta'), [
      "npc-state-delta/tests/v2/break/nested/new.test.js is not run by the package's npm test",
    ]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('recursive and quoted globs, examples tests, and node_modules are handled', () => {
  const script = 'NODE_OPTIONS="--x $NODE_OPTIONS" node --test "tests/*.test.js" "tests/v2/**/*.test.js" "examples/fishing/tests/*.test.js"';
  const dir = pkg(script, [
    'tests/a.test.js', 'tests/v2/x.test.js', 'tests/v2/deep/er/y.test.js', 'examples/fishing/tests/f.test.js',
    'examples/cards/tests/c.test.js', 'tests/node_modules/z/z.test.js',
  ]);
  try {
    assert.deepEqual(unrunTests(dir, 'p'), ["p/examples/cards/tests/c.test.js is not run by the package's npm test"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a test script with no node --test globs is an error', () => {
  const dir = pkg('echo none', ['tests/a.test.js']);
  try {
    assert.equal(unrunTests(dir, 'p').length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the command exits 1 and names the file on a fixture root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ptg-root-'));
  try {
    const dir = path.join(root, 'packages/nsd');
    fs.mkdirSync(path.join(dir, 'tests/v2/break/nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: nsdScript } }));
    fs.writeFileSync(path.join(dir, 'tests/v2/break/nested/new.test.js'), '\n');
    const r = spawnSync(process.execPath, [path.join(repo, 'scripts/checks/package-test-globs.mjs'), root], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /nsd\/tests\/v2\/break\/nested\/new\.test\.js is not run/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Node default test names (.mjs, .cjs, -test, _test, test-*, test.js, files under test/) are all enumerated', () => {
  const script = 'node --test "tests/*.test.js"';
  const files = ['tests/new.test.mjs', 'tests/a.test.cjs', 'tests/x-test.js', 'tests/y_test.mjs', 'tests/test-z.js', 'tests/test.js', 'test/any.js', 'tests/helper.js', 'tests/data.json'];
  const dir = pkg(script, files);
  try {
    assert.deepEqual(unrunTests(dir, 'p').map(e => e.split(' ')[0]),
      ['p/test/any.js', 'p/tests/a.test.cjs', 'p/tests/new.test.mjs', 'p/tests/test-z.js', 'p/tests/test.js', 'p/tests/x-test.js', 'p/tests/y_test.mjs']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an unquoted ** is expanded by the shell like one level; a nested test is then unrun, a shallow one is run', () => {
  const dir = pkg('node --test tests/*.test.js tests/v2/**/*.test.js', ['tests/a.test.js', 'tests/v2/break/b.test.js', 'tests/v2/break/nested/new.test.js']);
  try {
    assert.deepEqual(unrunTests(dir, 'p'), ["p/tests/v2/break/nested/new.test.js is not run by the package's npm test"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a quoted ** stays a recursive glob for Node', () => {
  const dir = pkg('node --test "tests/**/*.test.js"', ['tests/a.test.js', 'tests/v2/break/nested/new.test.js']);
  try {
    assert.deepEqual(unrunTests(dir, 'p'), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Node options between --test and the paths, and option values, are skipped', () => {
  const script = 'node --import ./setup.mjs --test --test-reporter=dot --test-reporter dot --import ./other.mjs "tests/*.test.js"';
  const dir = pkg(script, ['tests/a.test.js', 'tests/v2/b.test.js']);
  try {
    assert.deepEqual(unrunTests(dir, 'p'), ["p/tests/v2/b.test.js is not run by the package's npm test"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the real root runs every test file under tests/ and examples/*/tests through a root script', () => {
  assert.deepEqual(unrunRootTests(repo), []);
});

test('a root test file no root script or suite glob matches is named; one under a matched folder is not', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ptg-rootpkg-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'test:core': 'node --test "tests/core/**/*.test.js"', check: 'node --test "tests/orphan/*.test.js"' } }));
    for (const rel of ['tests/core/a.test.js', 'tests/core/deep/b.test.js', 'tests/orphan/c.test.js', 'tests/other/d.test.js']) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), '\n');
    }
    assert.deepEqual(unrunRootTests(root), ['tests/orphan/c.test.js is not run by any root test script', 'tests/other/d.test.js is not run by any root test script']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
