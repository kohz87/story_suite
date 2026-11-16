// Rewrites a file's relative import specifiers for the moved layout: resolve against the OLD place, map, write against the NEW place.
import path from 'node:path';
import { resolveSpecifier, scanSpecifiers } from './specifiers.mjs';

function relativeSpec(newFile, newTarget, added, original) {
  const base = added && newTarget.endsWith(added) ? newTarget.slice(0, -added.length) : newTarget;
  let rel = path.posix.relative(path.posix.dirname(newFile), base) || '.';
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return original.endsWith('/') && !rel.endsWith('/') ? `${rel}/` : rel;
}

/**
 * Rewrites the relative specifiers in `source`, a JS file that lived at `oldFile` and now lives at `newFile`.
 * `files` is the Set of tracked paths BEFORE the move and `mapper.map(path)` gives a path's new place (null when
 * deleted). Returns { source, changed, unresolved: [{spec,line}], removed: [{spec,line}], nonLiteral: [{kind,line}], error }.
 * Non-literal specifiers are only listed; the caller fails the run unless the file is on its allow-list.
 * Running it again on its own output with the same old/new path is a no-op.
 */
export function rewriteImports(source, { oldFile, newFile, files, mapper }) {
  const scan = scanSpecifiers(source);
  if (scan.error) return { source, changed: 0, unresolved: [], removed: [], nonLiteral: [], error: scan.error };
  const edits = [];
  const unresolved = [];
  const removed = [];
  for (const item of scan.specs) {
    if (!item.spec.startsWith('.')) continue;
    const hit = resolveSpecifier(oldFile, item.spec, files, item.kind === 'url');
    if (!hit) { unresolved.push({ spec: item.spec, line: item.line }); continue; }
    const target = mapper.map(hit.target);
    if (target === null) { removed.push({ spec: item.spec, line: item.line }); continue; }
    const next = relativeSpec(newFile, target, hit.added, item.spec);
    if (next !== item.spec) edits.push({ start: item.start + 1, end: item.end - 1, text: next });
  }
  let out = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return { source: out, changed: edits.length, unresolved, removed, nonLiteral: scan.nonLiteral, error: null };
}
