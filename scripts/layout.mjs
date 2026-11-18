import fs from 'node:fs';
import path from 'node:path';

/**
 * Reads scripts/layout.json (the source roots the root scripts walk, and the sibling-folder farm) from `root`,
 * with the lookup the scripts share: whether a repo path sits under a source root. Roots may list folders that do not exist yet.
 */
export function loadLayout(root = path.resolve(import.meta.dirname, '..')) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'scripts/layout.json'), 'utf8'));
  return {
    ...raw,
    isSourceFile: filePath => raw.sourceRoots.some(r => filePath.startsWith(`${r}/`)),
  };
}
