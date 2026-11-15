import { resolveSpecifier } from './resolve-spec.mjs';

// The binding an export finally refers to: follows `export { x } from`, `export * as`, and imports
// re-exported by name through the target's own namespace. Falls back to a key unique to this file.
function originOf(filePath, exp, ctx, seen) {
  const parsed = ctx.parsedByPath.get(filePath);
  const link = exp.from !== undefined ? { from: exp.from, imported: exp.local }
    : parsed.importBindings?.[exp.local];
  if (exp.kind === 'star' || exp.local === undefined || !link) return `${filePath}#${exp.local ?? exp.name}`;
  const target = resolveSpecifier(filePath, link.from, ctx.fileSet);
  if (!target || !ctx.parsedByPath.has(target)) return `${link.from}#${link.imported}`;
  if (link.imported === '*') return `${target}#*`;
  const sub = exportNames(target, ctx.parsedByPath, ctx.fileSet, new Set(seen));
  return sub.names.get(link.imported) ?? `${target}#${link.imported}`;
}

/**
 * The namespace of a file as `{ names, unresolved }`: `names` maps each exported name to the binding it
 * finally refers to (`file#name`), following named re-exports and `export * from` through internal
 * files. `default` is not forwarded by `*`. A name offered by two or more star sources with different
 * bindings, and not exported by the file itself, is ambiguous and left out; the same binding reached
 * twice is not ambiguous (ES rule). `unresolved` lists star targets that are not internal files in
 * the map, whose names cannot be counted. `parsedByPath` maps repo path to parseModule output; `seen`
 * guards against cycles.
 */
export function exportNames(filePath, parsedByPath, fileSet, seen = new Set()) {
  const names = new Map();
  const unresolved = [];
  if (seen.has(filePath)) return { names, unresolved };
  seen.add(filePath);
  const ctx = { parsedByPath, fileSet };
  const starred = new Map();
  for (const exp of parsedByPath.get(filePath)?.exports ?? []) {
    if (exp.kind !== 'star') { names.set(exp.name, originOf(filePath, exp, ctx, seen)); continue; }
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
