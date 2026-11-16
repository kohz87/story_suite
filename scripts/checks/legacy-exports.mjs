// The shrink-only list of moved legacy files that may keep more exports than the limit allows (docs/merge/legacy-exports.txt).

/** Parses the list (one repo path per line, blanks and # comments ignored) into a Set. */
export function parseExportsList(text) {
  const set = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line && !line.startsWith('#')) set.add(line);
  }
  return set;
}

/** Compares the current list with the base one: it may only shrink. `map` (optional) sends the base names through the layout rules first. Returns { errors }. */
export function checkExportsRatchet({ current, base, map = path => path }) {
  const errors = [];
  const moved = new Set([...base].map(map));
  for (const filePath of current) if (!base.has(filePath) && !moved.has(filePath)) errors.push(`${filePath}: added to the legacy exports list`);
  errors.sort();
  return { errors };
}
