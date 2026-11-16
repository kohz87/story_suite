import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runApply, runPort, runVerify } from '../../../scripts/codemod/area-commands.mjs';
import { main } from '../../../scripts/codemod/cli.mjs';
import { SET_A, SET_B } from '../codemod-sets.js';
import { TOY, git, toyRepo, writeFiles } from '../codemod-toy.js';

const sets = [SET_A, SET_B];
const sink = () => ({ text: '', write(chunk) { this.text += chunk; } });
const streams = () => ({ stdout: sink(), stderr: sink() });

test('apply --dry runs area b in a temp worktree, runs its tests and leaves the repo untouched', () => {
  const root = toyRepo(TOY);
  const io = streams();
  assert.equal(runApply(root, sets, 'b', { dry: true, ...io }), 0, io.stderr.text);
  assert.match(io.stdout.text, /b: 4 moves, 0 deletes, \d+ files rewritten/);
  assert.match(io.stdout.text, /tests: 1 moved test files, passed/);
  assert.equal(git(root, 'status', '--porcelain').trim(), '');
  assert.equal(git(root, 'worktree', 'list').trim().split('\n').length, 1);
  assert.equal(fs.existsSync(path.join(root, 'tests/core')), false);
});

test('apply --dry fails when a moved test fails', () => {
  const root = toyRepo({ ...TOY, 'pkg/tests/store.test.js': `${TOY['pkg/tests/store.test.js']}throw new Error('boom');\n` });
  const io = streams();
  assert.equal(runApply(root, sets, 'b', { dry: true, ...io }), 1);
  assert.match(io.stdout.text, /FAILED/);
});

test('apply then verify, area by area, with two commits each', () => {
  const root = toyRepo(TOY);
  for (const area of ['a', 'b']) {
    const io = streams();
    assert.equal(runApply(root, sets, area, { dry: false, ...io }), 0, io.stderr.text);
    const check = streams();
    assert.equal(runVerify(root, sets, area, { ...check }), 0, check.stderr.text);
    assert.match(check.stdout.text, new RegExp(`${area}: verified`));
  }
  assert.equal(git(root, 'log', '--format=%s', '-4').trim().split('\n').join('|'), 'layout: rewrite b|layout: move b|layout: rewrite a|layout: move a');
});

test('apply refuses an area with deletes unless a backup dir is given', () => {
  const root = toyRepo({ ...TOY, 'pkg/src/old/x.js': 'export const x = 1;\n' });
  const withDelete = { ...SET_B, rules: [...SET_B.rules, { from: 'pkg/src/old', to: null }] };
  const io = streams();
  assert.equal(runApply(root, [SET_A, withDelete], 'b', { dry: false, ...io }), 1);
  assert.match(io.stderr.text, /deletes 1 files: pass --backup/);
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/old/x.js')), true);
});

test('port-branch with an area ports one area of a lane branch and merges the layout commit', () => {
  const root = toyRepo(TOY);
  git(root, 'checkout', '-q', '-b', 'lane');
  writeFiles(root, { 'pkg/src/store-parts/b.js': "import { store } from '../store.js';\nexport const b = store;\n", 'pkg/src/ui/view.js': `${TOY['pkg/src/ui/view.js']}export const extra = 1;\n` });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lane work');
  git(root, 'checkout', '-q', 'main');
  const io = streams();
  assert.equal(runApply(root, sets, 'a', { dry: false, ...io }), 0, io.stderr.text);
  const port = streams();
  assert.equal(runPort(root, sets, 'a', 'lane', { mainRef: 'main', ...port }), 0, port.stderr.text);
  git(root, 'checkout', '-q', 'lane');
  assert.equal(fs.existsSync(path.join(root, 'core/store-parts/b.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'pkg/src/ui/view.js')), true);
  assert.match(fs.readFileSync(path.join(root, 'pkg/src/ui/view.js'), 'utf8'), /extra = 1/);
  assert.match(git(root, 'log', '--format=%s', '--grep=layout: port'), /layout: port to a/);
});

test('the cli rejects apply or verify without --area and port-branch without a branch', async () => {
  for (const argv of [['apply'], ['verify', '--all'], ['port-branch', '--area', 'core'], ['apply', '--area', 'core', 'extra'], ['apply', '--area', 'nope']]) {
    const io = streams();
    assert.equal(await main(argv, io), 2, argv.join(' '));
  }
});
