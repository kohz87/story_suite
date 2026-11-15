// Parsing, comparing and printing single versions.

import { SEMVER } from '../limits.js';
import { tagOf } from './shared-tag.js';

/**
 * [major, minor, patch, pre] of a version string; `pre` is null for a release, else the pre-release's
 * identifiers ([] is below every pre-release of that version). Null when not a version.
 */
export function parseVersion(text) {
    const written = String(text ?? '').trim();
    const match = SEMVER.exec(written);
    if (!match) return null;
    const tag = /^[^-+]*-([^+]+)/.exec(written)?.[1];
    return [Number(match[1]), Number(match[2]), Number(match[3]), tag ? tagOf(tag) : null];
}

function comparePre(a, b) {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        const x = a[i];
        const y = b[i];
        if (x === y) continue;
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        if (typeof x === 'number') return -1;
        if (typeof y === 'number') return 1;
        return x < y ? -1 : 1;
    }
    return a.length - b.length;
}

/** Negative, 0 or positive as version `a` comes before, with or after `b` ([major, minor, patch, pre?]). */
export const compareVersions = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]) || comparePre(a[3] ?? null, b[3] ?? null);

/** A parsed version as text: "2.1.0", "2.0.0-alpha.3". */
export const formatVersion = v => `${v[0]}.${v[1]}.${v[2]}${Array.isArray(v[3]) && v[3].length ? `-${v[3].join('.')}` : ''}`;
