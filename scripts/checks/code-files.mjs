import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Extensionless files are not checked: none exist in this repo, and a script must carry an extension.
const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.css', '.sh', '.bash', '.zsh', '.py',
]);
const IGNORED_SEGMENTS = new Set(['vendor', 'node_modules']);

/**
 * Returns true if the repo-relative path is a checked source or style file.
 */
export function isCodeFile(filePath) {
  const segments = filePath.replaceAll('\\', '/').split('/');
  if (segments.some(seg => IGNORED_SEGMENTS.has(seg))) return false;
  return CODE_EXTENSIONS.has(path.posix.extname(filePath));
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
 * Lists all tracked and untracked (non-ignored) code files under root, sorted.
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
    if (isCodeFile(posixPath)) files.add(posixPath);
  }
  return Array.from(files).sort();
}
