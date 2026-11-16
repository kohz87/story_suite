import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLayout } from '../../../scripts/codemod/apply.mjs';
import { runApply, runPort, runVerify } from '../../../scripts/codemod/area-commands.mjs';
import { main } from '../../../scripts/codemod/cli.mjs';
import { SET_A, SET_B } from '../codemod-sets.js';
import { TOY, git, toyRepo, writeFiles } from '../codemod-toy.js';

const sink = () => ({ text: '', write(chunk) { this.text += chunk; } });
const streams = () => ({ stdout: sink(), stderr: sink() });
const OLD = { ...TOY, 'pkg/src/old/x.js': 'export const x = 1;\n' };
const withDelete = { ...SET_B, rules: [...SET_B.rules, { from: 'pkg/src/old', to: null }] };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'codemod-safety-'));

test('applyLayout refuses to delete files without a backup dir', () => {
  const root = toyRepo(OLD);
  assert.throws(() => applyLayout(root, [SET_A, withDelete], { area: 'b' }), /pass a backup dir/);
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/old/x.js')), true);
});

test('port-branch --area on an area that deletes is refused without a backup and works with one', () => {
  const root = toyRepo(OLD);
  git(root, 'checkout', '-q', '-b', 'lane');
  writeFiles(root, { 'pkg/src/old/y.js': 'export const y = 1;\n' });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lane');
  git(root, 'checkout', '-q', 'main');
  const refused = streams();
  assert.equal(runPort(root, [SET_A, withDelete], 'b', 'lane', { mainRef: 'main', ...refused }), 1);
  assert.match(refused.stderr.text, /pass a backup dir/);
  const backup = path.join(tmp(), 'bk');
  const ok = streams();
  assert.equal(runPort(root, [SET_A, withDelete], 'b', 'lane', { mainRef: 'main', backupDir: backup, ...ok }), 0, ok.stderr.text);
  assert.equal(fs.existsSync(path.join(backup, 'pkg/src/old/y.js')), true);
});

test('apply --dry writes no backup into the real tree, even with a relative --backup', () => {
  const root = toyRepo(OLD);
  const io = streams();
  runApply(root, [SET_A, withDelete], 'b', { dry: true, backupDir: 'scratch/backups/dry', ...io });
  assert.equal(git(root, 'status', '--porcelain', '-uall').trim(), '');
  assert.equal(fs.existsSync(path.join(root, 'scratch')), false);
  assert.match(io.stdout.text, /b: \d+ moves, 1 deletes/);
});

test('a real apply backs up into a --backup dir resolved against the repo, not the process cwd', () => {
  const root = toyRepo(OLD);
  const io = streams();
  const outside = `../${path.basename(root)}-backup`;
  assert.equal(runApply(root, [SET_A, withDelete], 'b', { dry: false, backupDir: outside, ...io }), 0, io.stderr.text);
  assert.equal(fs.existsSync(path.join(root, outside, 'pkg/src/old/x.js')), true);
  fs.rmSync(path.join(root, outside), { recursive: true });
});

test('a real apply refuses a dirty tree and commits nothing', () => {
  const root = toyRepo(TOY);
  fs.writeFileSync(path.join(root, 'scratch-notes.txt'), 'mine\n');
  const io = streams();
  assert.equal(runApply(root, [SET_A, SET_B], 'a', { dry: false, ...io }), 1);
  assert.match(io.stderr.text, /not clean/);
  assert.equal(git(root, 'log', '--format=%s').trim(), 'toy');
});

test('applyLayout refuses a move whose target is another area\'s tracked file', () => {
  const root = toyRepo({ ...TOY, 'core/store.js': 'export const other = 1;\n' });
  assert.throws(() => applyLayout(root, [SET_A, SET_B], { area: 'a' }), /target is a tracked file that this run does not move or delete/);
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/store.js')), true);
});

test('verify names the move commit and the rewrite commit when a fix-up follows', () => {
  const root = toyRepo(TOY);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  assert.equal(runApply(root, [SET_A, SET_B], 'a', { dry: false, ...streams() }), 0);
  fs.appendFileSync(path.join(root, 'core/runtime/run.js'), '// fix-up\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'fix-up');
  const plain = streams();
  assert.equal(runVerify(root, [SET_A, SET_B], 'a', { base, ...plain }), 1, 'the fix-up is judged as the rewrite commit');
  const named = streams();
  assert.equal(runVerify(root, [SET_A, SET_B], 'a', { base, moves: 'HEAD~2', rewrites: 'HEAD~1', ...named }), 0, named.stderr.text);
});

test('the cli rejects a flag that does not apply to the command', async () => {
  for (const argv of [['verify', '--area', 'core', '--dry'], ['verify', '--area', 'core', '--backup', 'x'], ['apply', '--area', 'core', '--base', 'HEAD'], ['port-branch', 'lane', '--area', 'core', '--dry'], ['plan', '--all', '--moves', 'x']]) {
    const io = streams();
    assert.equal(await main(argv, io), 2, argv.join(' '));
    assert.match(io.stderr.text, /does not apply to/);
  }
});

test('non-literal specifiers are listed in full; an allow-listed file is counted but not judged', () => {
  const root = toyRepo({ ...TOY, 'pkg/src/ui/dyn.js': "import('./a' + name);\nimport('./b' + name);\n" });
  const io = streams();
  assert.equal(runApply(root, [SET_A, SET_B], 'b', { dry: true, ...io }), 1);
  assert.match(io.stdout.text, /non-literal \(not allow-listed\) \(2\):\n  pkg\/src\/ui\/dyn\.js:1 dynamic\n  pkg\/src\/ui\/dyn\.js:2 dynamic/);
  const allowed = streams();
  assert.equal(runApply(root, [SET_A, SET_B], 'b', { dry: true, allowNonLiteral: ['pkg/src/ui/dyn.js'], ...allowed }), 0, allowed.stderr.text);
  assert.match(allowed.stdout.text, /non-literal specifiers in allow-listed files: 2/);
});

test('the cli reads the allow-list file and passes it on', async () => {
  const root = toyRepo({ ...TOY, 'pkg/src/ui/dyn.js': "import('./a' + name);\n" });
  const list = path.join(tmp(), 'allow.txt');
  fs.writeFileSync(list, '# shrink only\npkg/src/ui/dyn.js\n');
  const rules = path.join(import.meta.dirname, '../../../scripts/codemod/layout');
  const args = ['apply', '--area', 'rpg', '--dry', '--root', root, '--rules', rules];
  const without = streams();
  assert.equal(await main(args, without), 1);
  assert.match(without.stdout.text, /non-literal \(not allow-listed\) \(1\)/);
  const withList = streams();
  assert.equal(await main([...args, '--allow-non-literal', list], withList), 0, withList.stderr.text);
  assert.match(withList.stdout.text, /allow-listed files: 1/);
});

test('verify runs the code map check by default and --no-codemap skips it; apply skips it unless --codemap', () => {
  const root = toyRepo({ ...TOY, 'scripts/codemap/cli.mjs': "console.log('stale map'); process.exit(1);\n" });
  const base = git(root, 'rev-parse', 'HEAD').trim();
  const io = streams();
  assert.equal(runApply(root, [SET_A, SET_B], 'a', { dry: false, ...io }), 0, io.stderr.text);
  const checked = streams();
  assert.equal(runVerify(root, [SET_A, SET_B], 'a', { base, ...checked }), 1);
  assert.match(checked.stderr.text, /codemap check failed: stale map/);
  assert.equal(runVerify(root, [SET_A, SET_B], 'a', { base, codemap: false, ...streams() }), 0);
});
