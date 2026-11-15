// The lookLockedAt stamp: making, reading and updating the { day, r } record of when the look was first set, and the lock test.
import { isObject, clean, lookText } from './shared-text.js';

const REPLY_MAX = 80;

/** A stamp { day, r } for the reply that set the look, or null when the day is not a whole number >= 0 or r is empty. */
export function lookStamp(day, r) {
    const whole = Math.trunc(Number(day));
    const reply = clean(r, REPLY_MAX);
    if (!Number.isFinite(whole) || whole < 0 || !reply) return null;
    return { day: whole, r: reply };
}

/** A stored stamp read back; anything malformed is null, never thrown. */
export function readLookStamp(value) {
    return isObject(value) ? lookStamp(value.day, value.r) : null;
}

/**
 * The stamp after an update. It is set when the look goes from empty to set (the first grounded look is the lock) and
 * otherwise kept as it was, so a later refinement never moves it. `before`/`after` are overallAppearance texts; `stamp` is
 * the stored lookLockedAt; `day`/`r` are the reply. → the stamp, or null.
 */
export function stampLook(before, after, stamp, day, r) {
    const stored = readLookStamp(stamp);
    if (lookText(before) || !lookText(after)) return stored;
    return lookStamp(day, r) ?? stored;
}

/** True when the look is locked: it has text and a readable stamp. This is what the "Look 🔒" mark reads. */
export function isLookLocked(text, stamp) {
    return Boolean(lookText(text) && readLookStamp(stamp));
}
