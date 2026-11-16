// Counts, per file, the relative specifiers that already resolve to nothing in a commit, so a migration is not blamed for them.
import { contentsAt, readGit } from './snapshot.mjs';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

/** Returns { files: Set of every path at `ref`, counts: Map of path -> number of relative specifiers that resolve to no file }. */
export function unresolvedBaseline(root, ref) {
  const files = new Set(readGit(root, ['ls-tree', '-r', '--name-only', ref]).toString().split('\n').filter(Boolean));
  const counts = new Map();
  for (const [name, text] of contentsAt(root, ref, [...files].filter(file => /\.m?js$/.test(file)))) {
    const scan = scanSpecifiers(text);
    const bad = (scan.specs ?? []).filter(item => item.spec.startsWith('.') && !resolveSpecifier(name, item.spec, files, item.kind === 'url')).length;
    if (bad) counts.set(name, bad);
  }
  return { files, counts };
}
