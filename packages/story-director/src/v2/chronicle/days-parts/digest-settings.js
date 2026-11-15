// Story Director v2, chronicle part: parsing day-digest retention and recap settings. Pure.

import { DIGEST_DEFAULTS, FULL_MAX, KEEP_MAX } from './digest-limits.js';
import { isInt, isRecord } from './shared-values.js';

/** The digest settings out of the chronicle part's settings (a function, an object, or nothing). */
export function digestSettings(source) {
    let value = source;
    if (typeof source === 'function') {
        try { value = source(); } catch { value = null; }
    }
    const own = isRecord(value) ? value : {};
    const whole = (raw, min, max, fallback) => {
        const n = Number(raw);
        return isInt(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const full = whole(own.digestDays, 1, FULL_MAX, DIGEST_DEFAULTS.digestDays);
    const keep = Math.max(full, whole(own.digestKeep, 1, KEEP_MAX, DIGEST_DEFAULTS.digestKeep));
    const hours = Number(own.recapHours);
    return {
        full,
        keep,
        tail: typeof own.digestTail === 'boolean' ? own.digestTail : DIGEST_DEFAULTS.digestTail,
        // The time part's While away threshold (read through `settings.reads`): a jump this long is a skip.
        skipMinutes: (isInt(hours) && hours >= 1 ? hours : 6) * 60,
    };
}
