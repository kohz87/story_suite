// Story Director v2, chronicle part: default settings and retention limits for day digests. Pure.

/** Settings: full digests kept, days kept in all (older ones are dropped). */
export const DIGEST_DEFAULTS = Object.freeze({ digestDays: 14, digestKeep: 120, digestTail: true });
export const FULL_MAX = 60;
export const KEEP_MAX = 365;
