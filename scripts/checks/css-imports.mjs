import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The extension's stylesheet (manifest "css") pulls the others in with @import; a path that names no file is a 404 at every start.
const IMPORT = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;

/** One problem string per @import, reachable from `entry` (a path under `root`), that names no file. */
export function cssImportProblems(root, entry = 'suite.css') {
  const problems = [];
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, spec] of text.matchAll(IMPORT)) {
      if (/^(https?:)?\/\//.test(spec) || spec.startsWith('data:')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      if (fs.existsSync(path.join(root, target))) queue.push(target);
      else problems.push(`${file}: @import '${spec}' names no file (${target})`);
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const problems = cssImportProblems(root, JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).css);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
