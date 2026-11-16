// Counts, per file, the relative specifiers that already resolve to nothing in a commit, so a migration is not blamed for them.
import { execFileSync } from 'node:child_process';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

const read = (root, args, input) => execFileSync('git', args, { cwd: root, input, maxBuffer: 1 << 30 });

// File contents at `ref`, read through one `git cat-file --batch` per chunk of names.
function* contentsAt(root, ref, names) {
  for (let start = 0; start < names.length; start += 400) {
    const chunk = names.slice(start, start + 400);
    const out = read(root, ['cat-file', '--batch'], chunk.map(name => `${ref}:${name}`).join('\n') + '\n');
    let at = 0;
    for (const name of chunk) {
      const eol = out.indexOf(10, at);
      const size = Number(out.subarray(at, eol).toString().split(' ')[2]);
      yield [name, out.subarray(eol + 1, eol + 1 + size).toString('utf8')];
      at = eol + 1 + size + 1;
    }
  }
}

/** Returns { files: Set of every path at `ref`, counts: Map of path -> number of relative specifiers that resolve to no file }. */
export function unresolvedBaseline(root, ref) {
  const files = new Set(read(root, ['ls-tree', '-r', '--name-only', ref]).toString().split('\n').filter(Boolean));
  const counts = new Map();
  for (const [name, text] of contentsAt(root, ref, [...files].filter(file => /\.m?js$/.test(file)))) {
    const scan = scanSpecifiers(text);
    const bad = (scan.specs ?? []).filter(item => item.spec.startsWith('.') && !resolveSpecifier(name, item.spec, files, item.kind === 'url')).length;
    if (bad) counts.set(name, bad);
  }
  return { files, counts };
}
