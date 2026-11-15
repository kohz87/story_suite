// Version ranges for `requires.storyBlock` (pure). A small subset of npm's semver ranges,
// enough for packs: `*`, `2`, `2.x`, `2.1`, `^2`, `^2.1`, `^2.1.3`, `~2.1`, `~2.1.3`,
// `>=2.0.0`, `>2`, `<3`, `<=2.4.0`, `=2.0.0`, `2.0.0`, comparators joined by spaces (all must
// hold) and alternatives joined by `||`. A comparator may name a pre-release (`>=2.0.0-alpha.3`).
//
// Pre-releases order the semver way (R2-b7-1): 2.0.0-alpha.1 < 2.0.0-alpha.3 < 2.0.0-beta < 2.0.0
// (identifiers compared one by one, numbers as numbers and below words, a shorter list first). A
// bound written as a whole version without a tag (`>=2.0.0`, `=2.0.0`) means that release, so an alpha
// host does not meet `>=2.0.0`. A bound the range only implies (`^2`, `~2.1`, `2.x`, `<3`, and the
// top of `^`/`~`) takes in that version's pre-releases, so packs written for `^2` work during the v2
// alpha, and `^2` ends before 3.0.0-alpha.
// Public face: re-exports its parts.

export { parseVersion, compareVersions, formatVersion } from './version-parts/single.js';
export { parseRange } from './version-parts/range.js';
export { satisfies } from './version-parts/satisfy.js';
