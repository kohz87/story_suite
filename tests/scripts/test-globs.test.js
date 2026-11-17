import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { unrunRootTests } from '../../scripts/checks/test-globs.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
// A fixture root whose package.json has one test script and which holds the given files.
function root(script, files) {
  const dir = tempDir('ptg-');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: script } }));
  for (const rel of files) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), '\n');
  }
  return dir;
}
const unrun = (script, files) => {
  const dir = root(script, files);
  try { return unrunRootTests(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const miss = file => `${file} is not run by any root test script`;

test('a nested test the globs miss is an error; the matched ones are not', () => {
  assert.deepEqual(unrun('node --max-old-space-size=4096 --import ./tests/setup.mjs --test tests/*.test.js tests/v2/break/*.test.js',
    ['tests/a.test.js', 'tests/v2/break/b.test.js', 'tests/v2/break/nested/new.test.js', 'tests/helper.js']), [miss('tests/v2/break/nested/new.test.js')]);
});

test('recursive and quoted globs, examples tests, and node_modules are handled', () => {
  const script = 'NODE_OPTIONS="--x $NODE_OPTIONS" node --test "tests/*.test.js" "tests/v2/**/*.test.js" "examples/fishing/tests/*.test.js"';
  assert.deepEqual(unrun(script, ['tests/a.test.js', 'tests/v2/x.test.js', 'tests/v2/deep/er/y.test.js', 'examples/fishing/tests/f.test.js', 'examples/cards/tests/c.test.js', 'tests/node_modules/z/z.test.js']),
    [miss('examples/cards/tests/c.test.js')]);
});

test('a test script with no node --test globs is an error', () => {
  assert.equal(unrun('echo none', ['tests/a.test.js']).length, 2);
});

test('the command exits 1 and names the file on a fixture root', () => {
  const dir = root('node --test "tests/*.test.js"', ['tests/a.test.js', 'tests/nested/new.test.js']);
  try {
    const r = spawnSync(process.execPath, [path.join(repo, 'scripts/checks/test-globs.mjs'), dir], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /tests\/nested\/new\.test\.js is not run/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Node default test names (.mjs, .cjs, -test, _test, test-*, test.js, files under test/) are all enumerated', () => {
  const files = ['tests/new.test.mjs', 'tests/a.test.cjs', 'tests/x-test.js', 'tests/y_test.mjs', 'tests/test-z.js', 'tests/test.js', 'test/any.js', 'tests/helper.js', 'tests/data.json'];
  assert.deepEqual(unrun('node --test "tests/*.test.js"', files).map(e => e.split(' ')[0]),
    ['test/any.js', 'tests/a.test.cjs', 'tests/new.test.mjs', 'tests/test-z.js', 'tests/test.js', 'tests/x-test.js', 'tests/y_test.mjs']);
});

test('an unquoted ** is expanded by the shell like one level; a nested test is then unrun, a shallow one is run', () => {
  assert.deepEqual(unrun('node --test tests/*.test.js tests/v2/**/*.test.js', ['tests/a.test.js', 'tests/v2/break/b.test.js', 'tests/v2/break/nested/new.test.js']), [miss('tests/v2/break/nested/new.test.js')]);
});

test('a quoted ** stays a recursive glob for Node', () => {
  assert.deepEqual(unrun('node --test "tests/**/*.test.js"', ['tests/a.test.js', 'tests/v2/break/nested/new.test.js']), []);
});

test('Node options between --test and the paths, and option values, are skipped', () => {
  const script = 'node --import ./setup.mjs --test --test-reporter=dot --test-reporter dot --import ./other.mjs "tests/*.test.js"';
  assert.deepEqual(unrun(script, ['tests/a.test.js', 'tests/v2/b.test.js']), [miss('tests/v2/b.test.js')]);
});

test('the real root runs every test file under tests/ and examples/*/tests through a root script', () => {
  assert.deepEqual(unrunRootTests(repo), []);
});

test('a root test file no root script or suite glob matches is named; one under a matched folder is not', () => {
  const root = tempDir('ptg-rootpkg-');
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { 'test:core': 'node --test "tests/core/**/*.test.js"', check: 'node --test "tests/orphan/*.test.js"' } }));
    for (const rel of ['tests/core/a.test.js', 'tests/core/deep/b.test.js', 'tests/orphan/c.test.js', 'tests/other/d.test.js']) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), '\n');
    }
    assert.deepEqual(unrunRootTests(root), ['tests/orphan/c.test.js is not run by any root test script', 'tests/other/d.test.js is not run by any root test script']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
