// Story Director v2, part **keypeople**: initial domain state and safe table accessor.

import { isRecord } from './primitives.js';

export function initialKeyPeople() {
    return { pins: {}, away: {}, gone: {}, notes: {} };
}

/** The slice with every table there (an older or empty one reads as empty). */
export function tables(slice) {
    const own = isRecord(slice) ? slice : {};
    return {
        pins: isRecord(own.pins) ? own.pins : {},
        away: isRecord(own.away) ? own.away : {},
        gone: isRecord(own.gone) ? own.gone : {},
        notes: isRecord(own.notes) ? own.notes : {},
    };
}
