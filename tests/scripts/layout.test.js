import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadLayout } from '../../scripts/layout.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
const node = (script, args = [], env = {}) => {
  const r = spawnSync('node', [path.join(repo, script), ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};

test('layout.json lists packages/ now and the B3 roots as entries that may not exist yet', () => {
  const layout = loadLayout();
  assert.deepEqual(layout.packageRoots, ['packages']);
  assert.deepEqual(layout.sourceRoots, ['core', 'ui', 'modules', 'packs', 'testkit']);
  assert.equal(layout.packageDevMap, 'docs/dev/codemap.md');
  assert.deepEqual(layout.suiteFarm.map(f => f.dir ?? Object.keys(f.files).join()), ['.', 'ui/legacy/director', 'core.js,src/storysuite-v2.js,src/npc-notes-kinds.js,src/npc-meters-presets.js']);
  assert.equal(layout.suiteFarm.find(f => f.link === 'Story_director').at, 'src/v2');
});

test('layout lookups: package roots, source roots, package name and folder', () => {
  const layout = loadLayout();
  assert.equal(layout.isPackageFile('packages/story-block/index.js'), true);
  assert.equal(layout.isPackageFile('ui/a.js'), false);
  assert.equal(layout.isSourceFile('core/x.js'), true);
  assert.equal(layout.isSourceFile('scripts/x.js'), false);
  assert.equal(layout.packageOf('packages/story-block/src/a.js'), 'story-block');
  assert.equal(layout.packageRootOf('packages/story-block/src/a.js'), 'packages/story-block');
  assert.equal(layout.packageRootOf('packages/pa/x.js'), 'packages/pa');
  assert.equal(layout.packageRootOf('packages/a/x.js'), 'packages/a');
  assert.equal(layout.packageOf('ui/a.js'), null);
  assert.deepEqual(layout.packageDirs(repo), []);
  assert.ok(!layout.packageDirs(repo).includes('packages/story-director'));
  assert.deepEqual(layout.packageDirs(os.tmpdir() + '/no-such-dir-b3p3'), []);
});

test('on today\'s tree the scripts give the same output as before (committed maps, same messages)', () => {
  const map = node('scripts/codemap/cli.mjs', ['--check']);
  assert.equal(map.status, 0, map.out);
  assert.match(map.out, /code map: docs\/codemap\.md \d+ files, up to date/);
  for (const line of map.out.trim().split('\n').slice(1)) {
    assert.match(line, /^code map: docs\/codemap\/[\w-]+\.md [\w-]+ \d+ files \(\d+ over the export limit\), up to date$/);
  }
  const globs = node('scripts/checks/test-globs.mjs');
  assert.equal(globs.out, 'test globs: every test file is run by a root npm test script\n');
  const size = node('scripts/checks/run-size-check.mjs');
  assert.equal(size.status, 0, size.out);
  assert.match(size.out, /^size check: no --base given; the legacy-list ratchet was not applied\nsize check: \d+ files, all within 450 lines or on the legacy list \(3 listed\)\n$/);
});

function demoRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('header and bullet jobs are accepted under the new roots; the old docs/dev/codemap.md is still read', () => {
  const dir = demoRepo({
    'package.json': '{"type":"module"}\n',
    'docs/codemap/jobs.json': '{}\n',
    'core/a.js': '// Does a in the core.\nexport const a = 1;\n',
    'modules/m/b.js': 'export const b = 1;\n',
    'ui/c.js': 'export const c = 1;\n',
    'docs/codemap/features-demo.json': '[{"name":"Main","entry":"src/p.js","about":"The p part."}]\n',
    'packages/demo/src/p.js': 'export const p = 1;\n',
    'packages/demo/docs/dev/codemap.md': '- `modules/m/b.js`: Does b from a bullet.\n- `ui/c.js`: Does c from a bullet.\n- `src/p.js`: Does p from the old place.\n',
  });
  try {
    const written = node('scripts/codemap/cli.mjs', ['--write'], { CODEMAP_ROOT: dir });
    assert.equal(written.status, 0, written.out);
    const root = fs.readFileSync(path.join(dir, 'docs/codemap.md'), 'utf8');
    assert.match(root, /Does a in the core\./);
    assert.match(root, /Does b from a bullet\./);
    assert.match(root, /Does c from a bullet\./);
    assert.match(fs.readFileSync(path.join(dir, 'docs/codemap/demo.md'), 'utf8'), /Does p from the old place\./);
    assert.equal(node('scripts/codemap/cli.mjs', ['--check'], { CODEMAP_ROOT: dir }).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a file under a new root with no job anywhere is still a problem; jobs.json wins over a bullet', () => {
  const dir = demoRepo({
    'package.json': '{"type":"module"}\n',
    'docs/codemap/jobs.json': '{"core/a.js":"From jobs.json."}\n',
    'core/a.js': '// From the header.\nexport const a = 1;\n',
    'core/n.js': 'export const n = 1;\n',
  });
  try {
    const r = node('scripts/codemap/cli.mjs', ['--write'], { CODEMAP_ROOT: dir });
    assert.equal(r.status, 1);
    assert.match(r.out, /core\/n\.js: no job sentence/);
    assert.doesNotMatch(r.out, /core\/a\.js: no job/);
    assert.match(fs.readFileSync(path.join(dir, 'docs/codemap.md'), 'utf8'), /From jobs\.json\./);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
