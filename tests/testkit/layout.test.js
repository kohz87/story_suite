// The testkit is one folder with one entry, imported by relative path: nothing in it names a package, a vendored copy or an old place.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const kit = path.join(root, 'testkit');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.(js|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('the testkit has no package file (a nearer one would change how Node loads its modules)', () => {
  assert.equal(fs.existsSync(path.join(kit, 'package.json')), false);
});

test('every import in the testkit is a relative path or a node: built-in', () => {
  for (const file of files(kit)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      assert.ok(spec.startsWith('.') || spec.startsWith('node:'), `${path.relative(root, file)} imports ${spec}`);
    }
  }
});

// The combination matrix (testkit/matrix) still finds Story Director and NPC State by sibling checkout; the module list replaces that.
test('the host builder files do not point at the old vendored place, a packages/ folder or src/v2', () => {
  for (const file of files(kit).filter(one => !one.includes(`${path.sep}matrix${path.sep}`))) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /tests\/vendor|packages\/|src\/v2/, path.relative(root, file));
  }
});

test('the entry exports the host builder and the fakes the module tests use', async () => {
  const kitApi = await import('../../testkit/index.js');
  for (const name of ['createHost', 'hostAvailable', 'createFakeContext', 'createFakeModel', 'createFakeStore', 'createFakeBus', 'stPurify']) {
    assert.equal(typeof kitApi[name], 'function', name);
  }
});
