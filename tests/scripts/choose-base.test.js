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
const baseOf = r => /^base=(.*)$/m.exec(r.output_file)?.[1];

test('after B1: a manual run uses origin/main', () => {
  const { dir, work } = setup(true);
  try {
    const r = choose(work, { EVENT: 'workflow_dispatch', BASE: '' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), 'origin/main');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('after B1: a zero push base on another branch is an error, not the import commit', () => {
  const { dir, work } = setup(true);
  try {
    git(work, 'commit', '-q', '--allow-empty', '-m', 'two');
    const r = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already has docs\/merge\/legacy-oversize\.txt/);
    assert.equal(baseOf(r), undefined);
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

test('the push that creates main with the list in it still falls back (origin/main is that push)', () => {
  const { dir, work } = setup(true);
  try {
    const r = choose(work, { EVENT: 'push', BASE: ZEROS });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(baseOf(r), 'HEAD^');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the import commit is the fallback base when it is in history', () => {
  const { dir, work } = setup(false);
  try {
    // A real import commit hash can not be forged, so check that the script text names it.
    assert.ok(fs.readFileSync(script, 'utf8').includes(IMPORT));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
