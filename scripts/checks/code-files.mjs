import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Every text file is checked except vendored copies, node_modules and data/asset files.
const DATA_EXTENSIONS = new Set([
  '.json', '.jsonl', '.md', '.txt', '.csv', '.yml', '.yaml', '.lock', '.svg', '.png', '.jpg', '.jpeg',
  '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.gz', '.zip', '.map',
]);
const IGNORED_SEGMENTS = new Set(['vendor', 'node_modules']);
// Licence texts are legal data, not code.
const DATA_FILES = [/(^|\/)(LICENSE|COPYING|NOTICE)(\.[A-Za-z]+)?$/, /(^|\/)package-lock\.json$/, /^docs\/history\/commit-map-[^/]*\.txt$/];

/**
 * Returns true if the repo-relative path is subject to the 450-line rule: anything that is not
 * vendored, under node_modules, or a data/asset file. Extensionless files are checked.
 */
export function isCodeFile(filePath) {
  const posixPath = filePath.replaceAll('\\', '/');
  if (posixPath.split('/').some(seg => IGNORED_SEGMENTS.has(seg))) return false;
  if (DATA_FILES.some(re => re.test(posixPath))) return false;
  return !DATA_EXTENSIONS.has(path.posix.extname(posixPath).toLowerCase());
}

function isBinaryFile(absPath) {
  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    return buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, 0)).includes(0);
  } finally {
    fs.closeSync(fd);
  }
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
 * Lists all tracked and untracked (non-ignored) checked text files under root, sorted; skips binary files (NUL in the first 8 KB), symlinks and files missing on disk.
 */
export function listCodeFiles(root) {
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
    if (!isCodeFile(posixPath)) continue;
    const abs = path.join(root, posixPath);
    const info = fs.lstatSync(abs, { throwIfNoEntry: false });
    if (!info || !info.isFile() || isBinaryFile(abs)) continue;
    files.add(posixPath);
  }
  return Array.from(files).sort();
}
