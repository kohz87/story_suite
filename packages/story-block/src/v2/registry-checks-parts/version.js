// Words the version a refused module needs.

import { parseRange, parseVersion, compareVersions, formatVersion } from '../packs/version.js';

// What a refused module needs, for the reader: "≥ 2.1.0" when every alternative of the range starts
// at a version above `version`, else the range as written ("<2", "^1.4").
export function neededVersion(range, version) {
    const v = parseVersion(version);
    const alternatives = parseRange(range);
    if (!v || !alternatives) return range;
    const lows = alternatives.map(checks => checks
        .filter(([op]) => op === '>=' || op === '=')
        .map(([, target]) => target)
        .reduce((best, target) => (!best || compareVersions(target, best) > 0 ? target : best), null));
    if (lows.some(low => !low)) return range;
    const lowest = lows.reduce((a, b) => (compareVersions(a, b) <= 0 ? a : b));
    return compareVersions(lowest, v) > 0 ? `≥ ${formatVersion(lowest)}` : range;
}
