// Cast domain slice initialization and slot/table accessors.

import { isInt, isRecord } from './shared-checks.js';

export function initialCast() {
    return { people: {}, notes: {}, day: null, meeting: null };
}

/** The slice with every table there (an older or empty one reads as empty). */
export function tables(slice) {
    const own = isRecord(slice) ? slice : {};
    return {
        people: isRecord(own.people) ? own.people : {},
        notes: isRecord(own.notes) ? own.notes : {},
    };
}

/** The value in a slot (a one-entry list, or a bare object), or null. */
export const slotOf = stored => {
    if (Array.isArray(stored)) return isRecord(stored[0]) ? stored[0] : null;
    return isRecord(stored) ? stored : null;
};

/** The story minute the cast was last moved to, or null. */
export const dayAt = slice => {
    const value = slotOf(slice?.day);
    return value && isInt(value.at) ? value.at : null;
};
