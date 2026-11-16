import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads scripts/layout.json (the source roots the root scripts walk) from `root`, with the lookups the
 * scripts share: whether a repo path sits under a package root or a source root, and which package it is.
 * Roots may list folders that do not exist yet.
 */
export function loadLayout(root = path.resolve(import.meta.dirname, '..')) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'scripts/layout.json'), 'utf8'));
  const under = (roots, filePath) => roots.some(r => filePath.startsWith(`${r}/`));
  const packageOf = filePath => {
    for (const r of raw.packageRoots) {
      if (filePath.startsWith(`${r}/`)) return filePath.slice(r.length + 1).split('/')[0] || null;
    }
    return null;
  };
  return {
    ...raw,
    isPackageFile: filePath => under(raw.packageRoots, filePath),
    isSourceFile: filePath => under(raw.sourceRoots, filePath),
    packageOf,
    packageRootOf: filePath => {
      const pkg = packageOf(filePath);
      return pkg === null ? null : filePath.slice(0, filePath.indexOf(pkg) + pkg.length);
    },
    packageDirs: base => raw.packageRoots.flatMap(r => {
      const dir = path.join(base, r);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => `${r}/${e.name}`);
    }),
  };
}
