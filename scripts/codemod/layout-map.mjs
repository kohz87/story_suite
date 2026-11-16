// Maps a path through the whole layout's rules alone (no plan), so a name given as of the old layout can be found after earlier areas moved it.
import { matchPath } from './rules.mjs';

/** Returns `path => where the rules put it` over all rule sets (a path no rule moves, or a deleted one, comes back as is). */
export function layoutMapper(ruleSets) {
  const rules = ruleSets.flatMap(set => set.rules);
  return filePath => matchPath(rules, filePath)?.to ?? filePath;
}

/** The names in `list` plus the place each one has once the layout is applied, as a Set (an entry keeps matching after its file moved). */
export function withLayoutPaths(list, ruleSets) {
  const map = layoutMapper(ruleSets);
  return new Set([...list, ...list.map(map)]);
}
