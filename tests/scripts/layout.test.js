import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadLayout } from '../../scripts/layout.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
const node = (script, args = [], env = {}) => {
  const r = spawnSync('node', [path.join(repo, script), ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};

test('layout.json lists the source roots and the sibling farm, and no package root', () => {
  const layout = loadLayout();
  assert.equal(layout.packageRoots, undefined);
  assert.deepEqual(layout.sourceRoots, ['core', 'ui', 'modules', 'packs', 'testkit']);
  assert.deepEqual(layout.suiteFarm.map(f => f.dir ?? Object.keys(f.files).join()), ['.', 'modules/director', 'core.js,core-prompts-lines.js,src/storysuite-v2.js,src/npc-notes-kinds.js,src/npc-meters-presets.js']);
  assert.equal(layout.suiteFarm.find(f => f.link === 'Story_director').at, 'src/v2');
});

test('layout lookup: source roots', () => {
  const layout = loadLayout();
  assert.equal(layout.isSourceFile('core/x.js'), true);
  assert.equal(layout.isSourceFile('scripts/x.js'), false);
  assert.equal(layout.isSourceFile('packages/a/x.js'), false);
});

test('on today\'s tree the scripts give the same output as before (committed maps, same messages)', () => {
  const map = node('scripts/codemap/cli.mjs', ['--check']);
  assert.equal(map.status, 0, map.out);
  assert.match(map.out, /^code map: docs\/codemap\.md \d+ files, up to date\n$/);
  const globs = node('scripts/checks/test-globs.mjs');
  assert.equal(globs.out, 'test globs: every test file is run by a root npm test script\n');
  const size = node('scripts/checks/run-size-check.mjs');
  assert.equal(size.status, 0, size.out);
  assert.match(size.out, /^size check: no --base given; the legacy-list ratchet was not applied\nsize check: \d+ files, all within 450 lines or on the legacy list \(0 listed\)\n$/);
});

function demoRepo(files) {
  const dir = tempDir('layout-');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('header and jobs.json jobs are accepted under the new roots', () => {
  const dir = demoRepo({
    'package.json': '{"type":"module"}\n',
    'core/a.js': '// Does a in the core.\nexport const a = 1;\n',
    'modules/m/b.js': 'export const b = 1;\n',
    'ui/c.js': '// Does c from its header.\nexport const c = 1;\n',
    'docs/codemap/jobs.json': '{"modules/m/b.js":"Does b from jobs.json."}\n',
  });
  try {
    const written = node('scripts/codemap/cli.mjs', ['--write'], { CODEMAP_ROOT: dir });
    assert.equal(written.status, 0, written.out);
    const root = fs.readFileSync(path.join(dir, 'docs/codemap.md'), 'utf8');
    assert.match(root, /Does a in the core\./);
    assert.match(root, /Does b from jobs\.json\./);
    assert.match(root, /Does c from its header\./);
    assert.equal(node('scripts/codemap/cli.mjs', ['--check'], { CODEMAP_ROOT: dir }).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a file under a new root with no job anywhere is still a problem; jobs.json wins over a header', () => {
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
