import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Returns one problem string for each tracked path in `git ls-files -s` output whose segments
 * include `node_modules` (whether directory entry, file, or symlink).
 */
export function trackedDepsProblems(lsFilesText) {
  const problems = [];
  for (const line of lsFilesText.split(/\r?\n/)) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const filePath = line.slice(tab + 1).replaceAll('\\', '/');
    if (filePath.split('/').includes('node_modules')) {
      problems.push(`${filePath}: node_modules must not be tracked`);
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const raw = execFileSync('git', ['ls-files', '-s'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const problems = trackedDepsProblems(raw);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log('no tracked node_modules');
}
