import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.resolve(import.meta.dirname, '../../scripts/ci/discover-suite-tests.sh');
const NAMED = [
  'tests/v2/lean-rpg/checks/suite.test.js', 'tests/v2/packs/holidays-world.test.js', 'tests/v2/packs/cast-presets.test.js',
  'tests/v2/integration/checks-flip.test.js', 'tests/v2/data-modules/unused.test.js', 'tests/v2/data-modules/example-b.test.js',
  'tests/v2/break/e2e-playthrough.test.js',
];

function fixture(extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dst-'));
  const files = { ...Object.fromEntries(NAMED.map(f => [`packages/story-block/${f}`, '// plain\n'])), ...extra };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const discover = root => spawnSync('bash', [script, root], { encoding: 'utf8' });
const rel = (root, out) => out.split('\n').filter(Boolean).map(p => path.relative(root, p)).sort();

test('named files, sibling-referencing tests and tests/suite files are all found', () => {
  const root = fixture({
    'packages/story-block/tests/v2/new/sibling.test.js': "process.env.STORY_SUITE_ROOT;\n",
    'packages/story-block/tests/v2/new/npc.test.js': 'const p = process.env.NPC_STATE_DELTA_PATH;\n',
    'packages/story-block/tests/v2/new/plain.test.js': '// no sibling\n',
    'packages/story-block/tests/v2/new/helper.js': 'Story_director\n',
    'packages/story-block/node_modules/x/dep.test.js': 'Story_director\n',
    'tests/suite/a/cross.test.js': '// root suite test\n',
    'tests/suite/a/readme.md': 'x\n',
  });
  try {
    const r = discover(root);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(rel(root, r.stdout), [
      ...NAMED.map(f => `packages/story-block/${f}`),
      'packages/story-block/tests/v2/new/npc.test.js',
      'packages/story-block/tests/v2/new/sibling.test.js',
      'tests/suite/a/cross.test.js',
    ].sort());
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('without tests/suite only the package files are found; each file is listed once', () => {
  const root = fixture({ 'packages/story-block/tests/v2/packs/cast-presets.test.js': 'loadSuite\n' });
  try {
    const r = discover(root);
    assert.deepEqual(rel(root, r.stdout), NAMED.map(f => `packages/story-block/${f}`).sort());
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a missing named file is an error', () => {
  const root = fixture({});
  try {
    fs.rmSync(path.join(root, 'packages/story-block', NAMED[0]));
    const r = discover(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing suite test/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
