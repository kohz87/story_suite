import { resolveSpecifier } from './resolve-spec.mjs';

/**
 * The namespace of a file as `{ names, unresolved }`: `names` maps each exported name to the file that
 * declares it, with `export * from` expanded through internal files. `default` is not forwarded by `*`.
 * A name offered by two or more star sources with different origins, and not exported by the file
 * itself, is ambiguous and left out (ES rule). `unresolved` lists star targets that are not internal
 * files in the map, whose names cannot be counted. `parsedByPath` maps repo path to parseModule output;
 * `seen` guards against cycles.
 */
export function exportNames(filePath, parsedByPath, fileSet, seen = new Set()) {
  const names = new Map();
  const unresolved = [];
  if (seen.has(filePath)) return { names, unresolved };
  seen.add(filePath);
  const starred = new Map();
  for (const exp of parsedByPath.get(filePath)?.exports ?? []) {
    if (exp.kind !== 'star') { names.set(exp.name, filePath); continue; }
    const target = resolveSpecifier(filePath, exp.from, fileSet);
    if (!target || !parsedByPath.has(target)) { unresolved.push(exp.from); continue; }
    const sub = exportNames(target, parsedByPath, fileSet, new Set(seen));
    unresolved.push(...sub.unresolved);
    for (const [name, origin] of sub.names) {
      if (name === 'default') continue;
      starred.set(name, starred.has(name) && starred.get(name) !== origin ? null : origin);
    }
  }
  for (const [name, origin] of starred) if (origin !== null && !names.has(name)) names.set(name, origin);
  return { names, unresolved };
}
