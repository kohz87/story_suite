// Reads the shrink-only list of expected plan problems and splits a problem list into known and new ones.
import fs from 'node:fs';

/** One problem per line, exact text; blank lines and `#` comment lines are ignored. */
export function loadKnownProblems(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}

/** Returns the problems not listed, the listed ones that were seen, and the listed ones that no longer occur. */
export function splitKnown(problems, known) {
  const listed = new Set(known);
  return {
    fresh: problems.filter(problem => !listed.has(problem)),
    seen: problems.filter(problem => listed.has(problem)),
    stale: known.filter(line => !problems.includes(line)),
  };
}
