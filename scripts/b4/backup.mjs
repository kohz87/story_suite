/**
 * Copies files to a new backup folder (same relative paths) and writes MANIFEST.txt there: sha256, bytes, lines and last commit per file.
 * Refuses, before writing anything, if the target folder exists, a path is absolute, leaves the repo, or is not a file.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BACKUP_ROOT = '/home/raven/story_suite/scratch/backups';

function lineCount(buffer) {
  const text = buffer.toString('utf8');
  return text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

/** The manifest text: a header line, then one `sha256  bytes  lines  commit  path` line per entry (entries: { path, sha256, bytes, lines, commit }). */
export function manifestText(unit, entries) {
  const rows = entries.map(e => `${e.sha256}  ${e.bytes}  ${e.lines}  ${e.commit || '-'}  ${e.path}`);
  return [`# backup of ${entries.length} files for ${unit}: sha256, bytes, lines, last commit, path`, ...rows, ''].join('\n');
}

/** Backs up `paths` (repo-relative files) from `root` into `<dest>/` and returns the manifest entries. `commitOf(path)` (optional) names the last commit. */
export function backupFiles({ root, dest, unit, paths, commitOf = () => '' }) {
  if (!paths.length) throw new Error('backup: no paths given');
  if (fs.existsSync(dest)) throw new Error(`backup: ${dest} already exists, refusing to overwrite`);
  const entries = [];
  for (const rel of [...new Set(paths)].sort()) {
    const norm = path.posix.normalize(rel.replaceAll('\\', '/'));
    if (path.isAbsolute(rel) || norm.startsWith('../') || norm === '..' || norm === '.') throw new Error(`backup: ${rel} is not a path inside the repo`);
    const from = path.join(root, norm);
    if (!fs.lstatSync(from, { throwIfNoEntry: false })?.isFile()) throw new Error(`backup: ${rel} is not a file`);
    entries.push({ path: norm, from, data: fs.readFileSync(from) });
  }
  fs.mkdirSync(dest, { recursive: true });
  const manifest = entries.map(e => {
    const to = path.join(dest, e.path);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, e.data);
    return { path: e.path, sha256: createHash('sha256').update(e.data).digest('hex'), bytes: e.data.length, lines: lineCount(e.data), commit: commitOf(e.path) };
  });
  fs.writeFileSync(path.join(dest, 'MANIFEST.txt'), manifestText(unit, manifest));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [unit, listFile, to = BACKUP_ROOT] = process.argv.slice(2);
  if (!unit || !listFile) { console.error('usage: backup.mjs <unit> <file with one repo path per line> [backup root]'); process.exit(2); }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const paths = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const commitOf = p => execFileSync('git', ['log', '-1', '--format=%h', '--', p], { cwd: root, encoding: 'utf8' }).trim();
  try { console.log(`backed up ${backupFiles({ root, unit, dest: path.join(to, unit), paths, commitOf }).length} files to ${path.join(to, unit)}`); } catch (error) { console.error(error.message); process.exit(1); }
}
