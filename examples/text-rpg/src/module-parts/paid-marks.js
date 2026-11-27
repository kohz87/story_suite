// A skill's cost is paid once a reply when a `~ spend` and a `? try` both name it (either order): the reply's own marks (slice.spent[sid], keyed `paid:<skill key>`) remember who paid.
import { practiceKey } from './practice.js';

const SPEND = 1;
const TRY = 2;
const BOTH = 3;

/**
 * Says whether this use of `skill` is already paid for, and records the use. `via` is 'spend' or 'try'.
 * Marks (whole numbers, as the slice's `spent` requires): SPEND 1 (a spend paid; a try is free), TRY 2 (a try paid; a spend is free), BOTH 3 (merged once; a spend is free, a try pays).
 * → true when the cost must not be taken again. Two tries, or two spends, each still pay.
 */
export function costPaidAlready(slice, sid, skill, via) {
    if (!sid || !skill?.cost) return false;
    slice.spent ??= {};
    const marks = slice.spent[sid] ??= {};
    const own = `paid:${practiceKey(skill.name)}`;
    const mark = marks[own];
    if (via === 'spend') {
        if (mark === TRY || mark === BOTH) return true;
        marks[own] = SPEND;
        return false;
    }
    if (mark === SPEND) {
        marks[own] = BOTH;
        return true;
    }
    marks[own] ??= TRY;
    return false;
}
