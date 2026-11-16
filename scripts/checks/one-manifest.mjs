import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Story Suite is one SillyTavern extension: one manifest.json, at the repo root. Kept history and example packs may hold their own.
const EXEMPT = ['docs/history/', 'examples/'];

/** One problem string for a missing root manifest and for each other tracked manifest.json outside the exempt folders (`git ls-files` text). */
export function manifestProblems(lsFilesText) {
  const files = lsFilesText.split(/\r?\n/).map(line => line.trim().replaceAll('\\', '/')).filter(Boolean);
  const problems = files
    .filter(file => path.posix.basename(file) === 'manifest.json' && file !== 'manifest.json' && !EXEMPT.some(prefix => file.startsWith(prefix)))
    .map(file => `${file}: a second manifest.json; Story Suite has one, at the repo root`);
  if (!files.includes('manifest.json')) problems.unshift('manifest.json: the root manifest is missing');
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const problems = manifestProblems(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
