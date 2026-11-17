import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { commitFolder } from '../../scripts/play/dist-git.mjs';
import { tempDir } from '../../scripts/temp-dir.mjs';

const put = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };

function makeRepo() {
  const repo = tempDir('play-commit-');
  execFileSync('git', ['init', '-q', '-b', 'trunk', repo]);
  put(repo, 'work/manifest.json', '{"display_name":"Story Suite (play build)"}\n');
  put(repo, 'work/js/entry.js', 'export const x = 1;\n');
  return repo;
}

function readObject(repo, sha) {
  const file = path.join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  const raw = zlib.inflateSync(fs.readFileSync(file));
  const split = raw.indexOf(0);
  const [type, size] = raw.subarray(0, split).toString().split(' ');
  const body = raw.subarray(split + 1);
  assert.equal(body.length, Number(size));
  return { type, body };
}

function treeRows(repo, sha) {
  const { type, body } = readObject(repo, sha);
  assert.equal(type, 'tree');
  const rows = [];
  for (let at = 0; at < body.length;) {
    const space = body.indexOf(32, at);
    const nul = body.indexOf(0, space);
    const mode = body.subarray(at, space).toString();
    const name = body.subarray(space + 1, nul).toString();
    const hash = body.subarray(nul + 1, nul + 21).toString('hex');
    rows.push({ mode, name, hash });
    at = nul + 21;
  }
  return rows;
}

function filesOf(repo, tree, prefix = '') {
  return treeRows(repo, tree).flatMap(row => row.mode === '40000' ? filesOf(repo, row.hash, `${prefix}${row.name}/`) : [`${prefix}${row.name}`]);
}

test('each build adds one commit on top of the previous play tip and keeps the folder as the tree root', () => {
  const repo = makeRepo();
  const first = commitFolder({ repo, folder: path.join(repo, 'work'), branch: 'play', message: 'Play build one' });
  const ref = fs.readFileSync(path.join(repo, '.git', 'refs', 'heads', 'play'), 'utf8').trim();
  assert.equal(ref, first);
  const one = readObject(repo, first);
  assert.equal(one.type, 'commit');
  assert.doesNotMatch(one.body.toString(), /^parent /m);
  assert.deepEqual(filesOf(repo, one.body.toString().match(/^tree ([0-9a-f]{40})$/m)[1]), ['js/entry.js', 'manifest.json']);

  put(repo, 'work/js/more.js', 'export const y = 2;\n');
  const second = commitFolder({ repo, folder: path.join(repo, 'work'), branch: 'play', message: 'Play build two' });
  assert.notEqual(second, first);
  assert.equal(fs.readFileSync(path.join(repo, '.git', 'refs', 'heads', 'play'), 'utf8').trim(), second);
  const two = readObject(repo, second);
  assert.match(two.body.toString(), new RegExp(`^parent ${first}$`, 'm'));
  assert.deepEqual(filesOf(repo, two.body.toString().match(/^tree ([0-9a-f]{40})$/m)[1]), ['js/entry.js', 'js/more.js', 'manifest.json']);
});

test('a rebuild writes ordinary git objects and does not move anything but the play ref', () => {
  const repo = makeRepo();
  const before = fs.readdirSync(path.join(repo, '.git', 'refs', 'heads'));
  commitFolder({ repo, folder: path.join(repo, 'work'), branch: 'play', message: 'Play build' });
  assert.deepEqual(fs.readdirSync(path.join(repo, '.git', 'refs', 'heads')), ['play']);
  assert.deepEqual(before, []);
});

test('--branch is validated: odd names, main/master and a branch checked out in a worktree are refused', () => {
  const repo = makeRepo();
  const run = branch => commitFolder({ repo, folder: path.join(repo, 'work'), branch, message: 'x' });
  for (const bad of ['main', 'master', '../x', 'a/b', '-x', 'a..b', 'x.lock', '']) assert.throws(() => run(bad), /refusing/, bad);
  assert.equal(fs.existsSync(path.join(repo, '.git', 'refs', 'heads', 'main')), false);
  // trunk is the checked-out branch of the (still unborn) main worktree, and a linked worktree holds another one.
  assert.throws(() => run('trunk'), /checked out/);
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'seed']);
  const linked = `${repo}-wt`;
  execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'held', linked]);
  assert.throws(() => run('held'), /checked out/);
  assert.match(run('play'), /^[0-9a-f]{40}$/);
});
