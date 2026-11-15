/**
 * Compares the current legacy-oversize list with the base one: the list may only shrink.
 * Both arguments are Maps of path -> line count. Returns { errors } with one message per violation.
 */
export function checkLegacyRatchet({ current, base }) {
  const errors = [];
  for (const [filePath, count] of current) {
    const baseCount = base.get(filePath);
    if (baseCount === undefined) errors.push(`${filePath}: added to the legacy list`);
    else if (count > baseCount) {
      errors.push(`${filePath}: legacy ceiling raised from ${baseCount} to ${count}`);
    }
  }
  errors.sort();
  return { errors };
}
