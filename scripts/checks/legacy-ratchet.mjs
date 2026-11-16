/**
 * Compares the current legacy-oversize list with the base one: the list may only shrink.
 * Both arguments are Maps of path -> line count. `map` (optional) is the layout's path mapper: the base list's names are sent through it first,
 * so an entry a layout move renamed (same count) is the same entry. Returns { errors } with one message per violation.
 */
export function checkLegacyRatchet({ current, base, map = path => path }) {
  const errors = [];
  const moved = new Map();
  for (const [filePath, count] of base) moved.set(map(filePath), count);
  for (const [filePath, count] of current) {
    const baseCount = moved.get(filePath) ?? base.get(filePath);
    if (baseCount === undefined) errors.push(`${filePath}: added to the legacy list`);
    else if (count > baseCount) {
      errors.push(`${filePath}: legacy ceiling raised from ${baseCount} to ${count}`);
    }
  }
  errors.sort();
  return { errors };
}

export const IMPORT_COMMIT = 'c340e6533a3eb63abfa0623870dbc8d6f9bf5927';

/**
 * Decides how to treat the base ref's legacy list. `read` is { text } when the list was read,
 * { missing: true } when git says the path does not exist in that commit, or { error } for anything else.
 * Returns { list: text } to compare against, { skip: true } for the import commit (no list yet), or { error }.
 */
export function decideBase({ ref, resolved, read }) {
  if (read.error) return { error: `cannot read the base ${ref}: ${read.error}` };
  if (read.missing) {
    if (resolved === IMPORT_COMMIT) return { skip: true };
    return { error: `the base ${ref} has no legacy list` };
  }
  return { list: read.text };
}
