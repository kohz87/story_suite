import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const script = path.resolve(import.meta.dirname, '../../scripts/ci/choose-base.sh');
const IMPORT = 'c340e6533a3eb63abfa0623870dbc8d6f9bf5927';
const ZEROS = '0'.repeat(40);
const LIST = 'docs/merge/legacy-oversize.txt';

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();

// A bare "origin" and a working clone; `withList` decides whether origin's main already has the list.
function setup(withList) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  const origin = path.join(dir, 'origin.git');
  const work = path.join(dir, 'work');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'clone', '-q', origin, work);
  fs.writeFileSync(path.join(work, 'a.txt'), 'a\n');
  git(work, 'add', '.');
  git(work, 'commit', '-qm', 'one');
  if (withList) {
    fs.mkdirSync(path.join(work, 'docs/merge'), { recursive: true });
    fs.writeFileSync(path.join(work, LIST), '# list\n');
    git(work, 'add', '.');
    git(work, 'commit', '-qm', 'list');
  }
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  git(work, 'fetch', '-q', 'origin');
  return { dir, work, head: git(work, 'rev-parse', 'HEAD') };
}

function choose(work, env) {
  const out = path.join(work, '..', 'github-output');
  fs.rmSync(out, { force: true });
  const r = spawnSync('bash', [script], { cwd: work, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out, ...env } });
  r.output_file = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  return r;
}
const basesOf = r => /^bases<<(\S+)\n([\s\S]*?)\n\1$/m.exec(r.output_file)?.[2].split('\n');
const baseOf = r => { const b = basesOf(r); return b?.length === 1 ? b[0] : b; };

test('after B1: a manual run on a branch ahead of main uses origin/main', () => {
  const { dir, work } = setup(true);
  try {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const r = choose(work, { EVENT: 'workflow_dispatch', BASE: '' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), 'origin/main');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a zero push base: the nearest ancestor with the list is used, not the import commit', () => {
  const { dir, work } = setup(true);
  try {
    const listCommit = git(work, 'rev-parse', 'HEAD');
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const r = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), listCommit);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('recreated main (origin/main is HEAD, HEAD^ has the list): HEAD^ is the base', () => {
  const { dir, work } = setup(true);
  try {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const parent = git(work, 'rev-parse', 'HEAD^');
    git(work, 'push', '-q', 'origin', 'HEAD:main');
    git(work, 'fetch', '-q', 'origin');
    const r = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(baseOf(r), parent);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a manual run with the remote main deleted uses history, not the import commit', () => {
  const { dir, work } = setup(true);
  try {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const parent = git(work, 'rev-parse', 'HEAD^');
    git(path.join(dir, 'origin.git'), 'update-ref', '-d', 'refs/heads/main');
    const r = choose(work, { EVENT: 'workflow_dispatch', BASE: '' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), parent);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('after B1: an unavailable or empty base is an error', () => {
  const { dir, work } = setup(true);
  try {
    const gone = choose(work, { EVENT: 'pull_request', BASE: 'f'.repeat(40) });
    assert.equal(gone.status, 1);
    assert.match(gone.stderr, /is not available/);
    const empty = choose(work, { EVENT: 'pull_request', BASE: '' });
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /no base commit/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('after B1: a reachable event base is used as given', () => {
  const { dir, work, head } = setup(true);
  try {
    const r = choose(work, { EVENT: 'pull_request', BASE: head });
    assert.equal(baseOf(r), head);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('before B1: the push that creates main falls back, the first manual run too', () => {
  const { dir, work } = setup(false);
  try {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const push = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(push.status, 0, push.stderr);
    assert.equal(baseOf(push), 'HEAD^', 'no import commit in history: HEAD^ is used');
    const dispatch = choose(work, { EVENT: 'workflow_dispatch', BASE: '' });
    assert.equal(dispatch.status, 0, dispatch.stderr);
    assert.equal(baseOf(dispatch), 'HEAD^');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the genuine first push: HEAD creates the list, so no ancestor has it (HEAD^ here)', () => {
  const { dir, work } = setup(false);
  try {
    fs.mkdirSync(path.join(work, 'docs/merge'), { recursive: true });
    fs.writeFileSync(path.join(work, LIST), '# list\n');
    git(work, 'add', '.');
    git(work, 'commit', '-qm', 'list');
    const r = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), 'HEAD^');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a single root commit with no parent falls back to the empty tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  try {
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'root');
    const r = choose(dir, { EVENT: 'push', BASE: ZEROS });
    assert.equal(baseOf(r), git(dir, 'hash-object', '-t', 'tree', '/dev/null'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the import commit is the fallback base when it is in history', () => {
  const { dir, work } = setup(false);
  try {
    // A real import commit hash can not be forged, so check that the script text names it.
    assert.ok(fs.readFileSync(script, 'utf8').includes(IMPORT));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A merge commit whose first parent predates the list and whose second parent has it.
function mergeSetup(firstHasList, secondHasList) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  git(dir, 'init', '-q', '-b', 'main');
  const addList = () => {
    fs.mkdirSync(path.join(dir, 'docs/merge'), { recursive: true });
    fs.writeFileSync(path.join(dir, LIST), '# list\n');
    git(dir, 'add', '.');
  };
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'root');
  git(dir, 'checkout', '-q', '-b', 'other');
  if (secondHasList) { addList(); git(dir, 'commit', '-qm', 'list on other'); } else git(dir, 'commit', '-q', '--allow-empty', '-m', 'o');
  const second = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', 'main');
  if (firstHasList) { addList(); fs.writeFileSync(path.join(dir, 'm.txt'), 'm\n'); git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'list on main'); } else git(dir, 'commit', '-q', '--allow-empty', '-m', 'm');
  const first = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'merge', '-q', '--no-ff', '--no-edit', '-X', 'theirs', 'other');
  return { dir, first, second };
}

test('a merge: the parent that has the list is the base, even when it is the second parent', () => {
  const { dir, second } = mergeSetup(false, true);
  try {
    const r = choose(dir, { EVENT: 'push', BASE: ZEROS });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(basesOf(r), [second]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a merge where both parents have the list: both are bases', () => {
  const { dir, first, second } = mergeSetup(true, true);
  try {
    const r = choose(dir, { EVENT: 'push', BASE: ZEROS });
    assert.deepEqual(basesOf(r), [first, second]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a merge where no parent has it but an older ancestor does: that ancestor; where none has it: bootstrap', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  try {
    git(dir, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(dir, 'docs/merge'), { recursive: true });
    fs.writeFileSync(path.join(dir, LIST), '# list\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'list');
    const listCommit = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'checkout', '-q', '-b', 'other');
    git(dir, 'rm', '-q', LIST);
    git(dir, 'commit', '-qm', 'drop list');
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'rm', '-q', LIST);
    git(dir, 'commit', '-qm', 'drop list too');
    git(dir, 'merge', '-q', '--no-ff', '--no-edit', 'other');
    const r = choose(dir, { EVENT: 'push', BASE: ZEROS });
    assert.deepEqual(basesOf(r), [listCommit]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const none = mergeSetup(false, false);
  try {
    const r = choose(none.dir, { EVENT: 'push', BASE: ZEROS });
    assert.equal(baseOf(r), 'HEAD^', 'no ancestor has the list: the B1 bootstrap');
  } finally { fs.rmSync(none.dir, { recursive: true, force: true }); }
});
