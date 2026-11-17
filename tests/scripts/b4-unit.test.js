import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEntries } from '../../scripts/b4/dead-exports.mjs';
import { recipeSteps, removedFiles } from '../../scripts/b4/unit.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b4-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'old'));
  fs.mkdirSync(path.join(root, 'docs/merge'), { recursive: true });
  fs.writeFileSync(path.join(root, 'old/a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'keep.js'), 'export const k = 1;\n');
  fs.writeFileSync(path.join(root, 'docs/merge/core-module-refs.txt'), '# c\nold/a.js :: line\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}
const steps = (root, over = {}) => recipeSteps({ root, unit: 'u1', entries: parseEntries('old/a.js\n'), greps: [], tests: ['t'], base: 'HEAD', to: path.join(root, '_bk'), ...over });

test('the steps run in the documented order', t => {
  assert.deepEqual(steps(repo(t)).map(s => s.name), ['backup', 'git rm', 'dead exports', 'git grep empty', 'shrink-only lists', 'code map', 'touched tests']);
});

test('removedFiles expands dirs over the tracked files', () => {
  assert.deepEqual(removedFiles(parseEntries('a/b.js\nd/'), ['a/b.js', 'a/c.js', 'd/x.js', 'dd/y.js']), ['a/b.js', 'd/x.js']);
});

test('backup then git rm: the file is saved, then gone from the index', t => {
  const root = repo(t);
  const [backup, rm] = steps(root);
  assert.deepEqual(backup.run(), []);
  assert.deepEqual(rm.run(), []);
  assert.equal(fs.readFileSync(path.join(root, '_bk/u1/old/a.js'), 'utf8'), 'export const a = 1;\n');
  assert.equal(git(root, 'ls-files', 'old').trim(), '');
  assert.throws(() => steps(root)[0].run(), /nothing|not a file|no paths/);
});

test('git grep fails while a name is still used and passes when it is gone', t => {
  const root = repo(t);
  const [, , , grep] = steps(root, { greps: ['k = 1'] });
  assert.match(grep.run()[0], /still finds/);
  assert.deepEqual(steps(root, { greps: ['no such text anywhere'] })[3].run(), []);
});

test('shrink-only step names a stale entry for a removed file, and an added entry', t => {
  const root = repo(t);
  fs.appendFileSync(path.join(root, 'docs/merge/core-module-refs.txt'), 'keep.js :: new\n');
  const problems = steps(root)[4].run();
  assert.ok(problems.some(p => /entry added: keep\.js :: new/.test(p)));
  assert.ok(problems.some(p => /names a removed path.*old\/a\.js/.test(p)));
});

test('the CLI prints its plan and rejects a missing entries file', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'e.txt'), 'old/a.js\n');
  const cli = path.resolve('scripts/b4/unit.mjs');
  const plan = spawnSync('node', [cli, 'u1', '--entries', path.join(root, 'e.txt'), '--plan'], { cwd: root, encoding: 'utf8' });
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /1\. backup[\s\S]*7\. touched tests/);
  assert.equal(spawnSync('node', [cli, 'u1'], { cwd: root }).status, 2);
});
