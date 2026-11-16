// Story Director v2, chronicle part: which days a digest must write and when the hook should ask for one. Pure.

import { daysOf, entriesByDay, notedOf, writtenOf } from '../days.js';
import { isInt } from './shared-ask.js';

/** The days to write now: those since `written.through` up to yesterday, and those it had that are gone. */
export function daysToWrite(chronicle, today) {
    const written = writtenOf(chronicle);
    const kept = daysOf(chronicle);
    const missing = (written?.days ?? []).filter(day => isInt(day) && day < today && !Object.hasOwn(kept, String(day)));
    return { from: written ? written.through : null, missing };
}

/**
 * Whether the hook should commit `chronicle.digest` on `state` at story day `today`: the day moved
 * since digests were last written, or a day written then is gone. With nothing written yet, when the
 * clock has moved into a later day since the time part last settled it (`settledDay`), or the notes
 * began on an earlier day (`chronicle.noted.from`) or kept facts of one: the digest was off while a
 * day ended, and is back on (B-c2-3).
 */
export function needsDigest(chronicle, today, { settledDay = null } = {}) {
    if (!chronicle || !isInt(today)) return false;
    const written = writtenOf(chronicle);
    if (!written) {
        const begun = notedOf(chronicle)?.from;
        const earlier = [...entriesByDay(chronicle).keys()].some(day => day < today);
        return (isInt(settledDay) && settledDay < today) || (isInt(begun) && begun < today) || earlier;
    }
    if (written.through !== today) return true;
    return daysToWrite(chronicle, today).missing.length > 0;
}
