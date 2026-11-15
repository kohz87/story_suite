import { resolveSpecifier } from './resolve-spec.mjs';

/**
 * The names a file exports, with `export * from` expanded through internal files (`default` is not
 * forwarded by `*`). An external or unresolvable target stays as one `* from '<spec>'` entry.
 * `parsedByPath` maps repo path to parseModule output; `seen` guards against cycles.
 */
export function exportNames(filePath, parsedByPath, fileSet, seen = new Set()) {
  const names = new Set();
  if (seen.has(filePath)) return names;
  seen.add(filePath);
  for (const exp of parsedByPath.get(filePath)?.exports ?? []) {
    if (exp.kind !== 'star') { names.add(exp.name); continue; }
    const target = resolveSpecifier(filePath, exp.from, fileSet);
    if (!target || !parsedByPath.has(target)) { names.add(`* from '${exp.from}'`); continue; }
    for (const name of exportNames(target, parsedByPath, fileSet, seen)) if (name !== 'default') names.add(name);
  }
  return names;
}
