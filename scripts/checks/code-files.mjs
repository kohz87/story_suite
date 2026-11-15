import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Every text file is checked except vendored copies, node_modules and data/asset files.
const DATA_EXTENSIONS = new Set([
  '.json', '.jsonl', '.md', '.txt', '.csv', '.lock', '.svg', '.png', '.jpg', '.jpeg',
  '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.gz', '.zip', '.map',
]);
const IGNORED_SEGMENTS = new Set(['vendor', 'node_modules']);
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);
// Licence texts are legal data, not code; only these exact names count (LICENSE.js is code).
const DATA_FILES = [/(^|\/)(LICENSE|COPYING|NOTICE)(\.md|\.txt)?$/, /(^|\/)package-lock\.json$/, /^docs\/history\/commit-map-[^/]*\.txt$/];

/**
 * Returns true if the repo-relative path is subject to the 450-line rule: anything that is not
 * vendored, under node_modules, or a data/asset file. Extensionless files are checked.
 */
export function isCodeFile(filePath) {
  const posixPath = filePath.replaceAll('\\', '/');
  if (posixPath.split('/').some(seg => IGNORED_SEGMENTS.has(seg))) return false;
  if (DATA_FILES.some(re => re.test(posixPath))) return false;
  const ext = path.posix.extname(posixPath).toLowerCase();
  // YAML under .github/ (workflows, composite actions) runs shell commands, so it is checked; other YAML is data.
  if (YAML_EXTENSIONS.has(ext)) return posixPath.startsWith('.github/');
  return !DATA_EXTENSIONS.has(ext);
}

/**
 * Returns true if the repo-relative path is a test file or inside a test folder.
 */
export function isTestFile(filePath) {
  const segments = filePath.replaceAll('\\', '/').split('/');
  if (segments.some(seg => seg === 'tests' || seg === 'test')) return true;
  const base = segments[segments.length - 1] ?? '';
  return base.includes('.test.');
}

/**
 * Lists every tracked and untracked (non-ignored) regular file under root, sorted; skips symlinks and
 * files missing on disk.
 */
export function listRepoFiles(root) {
  // Include --others so newly created files are checked before the lead commits.
  const raw = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  const files = new Set();
  for (const entry of raw.split('\0')) {
    if (!entry) continue;
    const posixPath = entry.replaceAll('\\', '/');
    const abs = path.join(root, posixPath);
    const info = fs.lstatSync(abs, { throwIfNoEntry: false });
    if (!info || !info.isFile()) continue;
    files.add(posixPath);
  }
  return Array.from(files).sort();
}

/**
 * Lists the repo files subject to the checks. Known binary/asset extensions are skipped by name; any
 * other file is read as text, so a NUL byte can not hide source.
 */
export function listCodeFiles(root) {
  return listRepoFiles(root).filter(isCodeFile);
}
