import path from 'node:path';

/** Resolves a relative import specifier to a repo path in `fileSet`, or '' if external or unknown. */
export function resolveSpecifier(filePath, spec, fileSet) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return '';
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), spec));
  return fileSet.has(target) ? target : '';
}
