// Testing whether a version satisfies a range.

import { parseVersion, compareVersions } from './single.js';
import { parseRange } from './range.js';

const compare = compareVersions;
const HOLDS = { '=': c => c === 0, '>': c => c > 0, '>=': c => c >= 0, '<': c => c < 0, '<=': c => c <= 0 };

/** Does `version` satisfy `range`? False when either does not parse. */
export function satisfies(version, range) {
    const v = parseVersion(version);
    const alternatives = parseRange(range);
    if (!v || !alternatives) return false;
    return alternatives.some(checks => checks.every(([op, target]) => HOLDS[op](compare(v, target))));
}
