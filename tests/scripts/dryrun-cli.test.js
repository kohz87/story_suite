import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempDir } from '../../scripts/temp-dir.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = path.join(REPO_ROOT, 'scripts/dryrun/cli.mjs');

function sandbox(t) {
  const dir = tempDir('dryrun-cli-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function chatsFolder(dir) {
  const chats = path.join(dir, 'chats');
  mkdirSync(chats);
  const lines = [
    { user_name: 'Reader', character_name: 'Guide', chat_metadata: {} },
    { name: 'Guide', is_user: false, is_system: false, mes: 'Welcome.' },
    { name: 'Reader', is_user: true, is_system: false, mes: 'Hello.' },
    { name: 'Guide', is_user: false, is_system: false, mes: 'Good to see you.' },
  ];
  writeFileSync(path.join(chats, 'synthetic.jsonl'), lines.map(item => JSON.stringify(item)).join('\n') + '\n');
  return chats;
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, cwd: os.tmpdir() });
}

const record = (chats, out, extra = [], env = {}) => run(['record', '--code', REPO_ROOT, '--chats', chats, '--out', out, ...extra], env);

test('record clears SUITE_* env and loads from --code', t => {
  const dir = sandbox(t);
  const bogus = path.join(dir, 'not-a-checkout');
  const res = record(chatsFolder(dir), path.join(dir, 'out'), [], { SUITE_SB: bogus, SUITE_SD: bogus, SUITE_NSD: bogus });
  assert.match(res.stdout, /synthetic\.jsonl: \d+ replies/, res.stderr);
  assert.doesNotMatch(res.stderr, /not from --code|skipped/);
  assert.ok(existsSync(path.join(dir, 'out', 'synthetic.jsonl.json')));
});

test('record refuses a chats folder with no chats', t => {
  const dir = sandbox(t);
  const empty = path.join(dir, 'empty');
  mkdirSync(empty);
  const res = record(empty, path.join(dir, 'out'));
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /No \.jsonl or \.jsonl\.gz chats/);
});

test('compare fails when there is nothing to compare', t => {
  const dir = sandbox(t);
  const a = path.join(dir, 'a');
  const b = path.join(dir, 'b');
  mkdirSync(a);
  mkdirSync(b);
  const res = run(['compare', a, b]);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /nothing was compared/);
});

test('record refuses --out inside a git checkout or inside --code', t => {
  const dir = sandbox(t);
  const chats = chatsFolder(dir);
  const repo = path.join(dir, 'repo');
  mkdirSync(repo);
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
  const inGit = record(chats, path.join(repo, 'new', 'deeper'));
  assert.notEqual(inGit.status, 0);
  assert.match(inGit.stderr, /inside the git checkout/);
  assert.ok(!existsSync(path.join(repo, 'new')), 'nothing was created in the checkout');
  const inCode = record(chats, path.join(REPO_ROOT, 'dryrun-out-should-not-exist'));
  assert.notEqual(inCode.status, 0);
  assert.match(inCode.stderr, /inside the --code repo/);
  assert.ok(!existsSync(path.join(REPO_ROOT, 'dryrun-out-should-not-exist')));
});

test('record refuses a non-empty --out without --fresh, and --fresh removes only the files it listed', t => {
  const dir = sandbox(t);
  const chats = chatsFolder(dir);
  const out = path.join(dir, 'out');
  assert.match(record(chats, out).stdout, /synthetic\.jsonl: /);
  const mine = path.join(out, 'synthetic.jsonl.json');
  assert.ok(existsSync(mine));

  const again = record(chats, out);
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /not empty.*--fresh/);

  const foreign = path.join(out, 'keep-me.txt');
  writeFileSync(foreign, 'not written by the tool');
  const blocked = record(chats, out, ['--fresh']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /did not write/);
  assert.ok(!existsSync(mine), 'the listed file was removed');
  assert.deepEqual(readdirSync(out), ['keep-me.txt']);

  rmSync(foreign);
  assert.match(record(chats, out, ['--fresh']).stdout, /synthetic\.jsonl: /);
  assert.ok(existsSync(mine));
});

test('record --history writes the sequence', t => {
  const dir = sandbox(t);
  const chats = chatsFolder(dir);
  const out = path.join(dir, 'out');
  const res = record(chats, out, ['--history']);
  assert.match(res.stdout, /synthetic\.jsonl: /, res.stderr);
  const written = JSON.parse(readFileSync(path.join(out, 'synthetic.jsonl.json'), 'utf8'));
  assert.deepEqual(written.history.ops.map(op => op.op), ['swipe', 'deleteMiddle', 'rewind', 'reload']);
});
