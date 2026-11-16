// Reads a main commit into a temporary source tree and commits the built folder to the local play
// branch. The commit is written as git objects directly, so a build keeps the branch history and
// never rewrites it: every build adds one ordinary commit on top of the previous one.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { git } from './git.mjs';

const SOURCES = ['packages/story-block', 'packages/story-director', 'packages/npc-state-delta', 'ui'];
const IDENTITY = { name: process.env.GIT_AUTHOR_NAME || 'play-build', email: process.env.GIT_AUTHOR_EMAIL || 'play-build@localhost' };

/** The full commit id of `ref` in `repo`. */
export function fullCommit(repo, ref) {
  return git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]);
}

/** Extracts the four source folders of `commit` into a new temporary folder (caller removes it). */
export function extractSource(repo, commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-src-'));
  const tarFile = path.join(dir, 'source.tar');
  git(repo, ['archive', '--format=tar', '--output', tarFile, commit, '--', ...SOURCES]);
  execFileSync('tar', ['-xf', tarFile, '-C', dir], { stdio: 'ignore' });
  fs.rmSync(tarFile);
  return dir;
}

function gitCommonDir(repo) {
  const dot = path.join(repo, '.git');
  const gitDir = fs.statSync(dot).isDirectory() ? dot : path.resolve(repo, fs.readFileSync(dot, 'utf8').match(/^gitdir:\s*(.+)$/m)[1].trim());
  const common = path.join(gitDir, 'commondir');
  return fs.existsSync(common) ? path.resolve(gitDir, fs.readFileSync(common, 'utf8').trim()) : gitDir;
}

const ZERO = '0'.repeat(40);

/** Throws unless `branch` is a plain local name that no worktree has checked out and that is not main/master. */
export function checkBranch(repo, branch) {
  if (!/^[A-Za-z0-9._-]+$/.test(branch) || /^[.-]|\.\.|\.lock$|\.$/.test(branch)) throw new Error(`refusing branch name "${branch}": use letters, digits, dot, dash or underscore only`);
  if (branch === 'main' || branch === 'master') throw new Error(`refusing to write the ${branch} branch`);
  const checkedOut = git(repo, ['worktree', 'list', '--porcelain']).split('\n').some(row => row === `branch refs/heads/${branch}`);
  if (checkedOut) throw new Error(`refusing branch "${branch}": it is checked out in a worktree`);
}

function readRef(repo, branch) {
  try { return git(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}^{commit}`]); } catch { return ''; }
}

function writeObject(common, type, content) {
  const raw = Buffer.concat([Buffer.from(`${type} ${content.length}\0`), content]);
  const sha = createHash('sha1').update(raw).digest('hex');
  const file = path.join(common, 'objects', sha.slice(0, 2), sha.slice(2));
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, zlib.deflateSync(raw));
  }
  return sha;
}

function treeOf(common, dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.name !== '.git');
  const rows = entries.map(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return { name: entry.name, mode: '40000', sha: treeOf(common, full), key: `${entry.name}/` };
    return { name: entry.name, mode: '100644', sha: writeObject(common, 'blob', fs.readFileSync(full)), key: entry.name };
  });
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const body = rows.map(row => Buffer.concat([Buffer.from(`${row.mode} ${row.name}\0`), Buffer.from(row.sha, 'hex')]));
  return writeObject(common, 'tree', Buffer.concat(body));
}

function stamp() {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
  return `${Math.floor(now.getTime() / 1000)} ${zone}`;
}

/** Commits the contents of `folder` as one commit on `branch`, parented by the branch's previous tip. */
export function commitFolder({ repo, folder, branch = 'play', message }) {
  checkBranch(repo, branch);
  const common = gitCommonDir(repo);
  const tree = treeOf(common, folder);
  const parent = readRef(repo, branch);
  const when = stamp();
  const lines = [`tree ${tree}`];
  if (parent) lines.push(`parent ${parent}`);
  lines.push(`author ${IDENTITY.name} <${IDENTITY.email}> ${when}`, `committer ${IDENTITY.name} <${IDENTITY.email}> ${when}`, '', message.endsWith('\n') ? message : `${message}\n`);
  const sha = writeObject(common, 'commit', Buffer.from(lines.join('\n')));
  // Compare-and-swap: fails if another build moved the branch since we read it; leaves a reflog entry.
  git(repo, ['update-ref', '-m', `play build: ${sha.slice(0, 9)}`, `refs/heads/${branch}`, sha, parent || ZERO]);
  return sha;
}
