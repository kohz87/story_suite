/**
 * The shrink-only lists under docs/merge: finds an entry added since the base, and an entry that still names a removed path (it must leave the list).
 * Entry lines are the non-blank, non-`#` lines; the layout lists and the grow-only removed-exports list are not in LISTS.
 */
export const LISTS = [
  'docs/merge/core-module-refs.txt',
  'docs/merge/global-exceptions.txt',
  'docs/merge/legacy-exports.txt',
  'docs/merge/legacy-oversize.txt',
  'docs/merge/layout-nonliteral.txt',
];

const entries = text => (text ?? '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));

/** Entries of `current` that the base list did not have (a new entry is never allowed). A list new since the base counts whole. */
export function addedEntries(baseText, currentText) {
  const had = new Set(entries(baseText));
  return entries(currentText).filter(line => !had.has(line));
}

/** Entries of `text` that name a removed file (`path`, or a path under a `dir/`): `removed` is a Set of files plus an array of dirs. */
export function staleEntries(text, removed) {
  const files = [...removed.files];
  return entries(text).filter(line => files.some(f => line.includes(f)) || removed.dirs.some(d => line.includes(d)));
}
