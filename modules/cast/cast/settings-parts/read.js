// Reading cast settings and checking whether the cast feature is active.

import { DEFAULT_FACES, FACES, FEATURE } from '../domain.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The cast settings out of the part's values. */
export function castSettings(values) {
    const given = isRecord(values) ? values : {};
    return {
        on: given.on !== false,
        faces: Object.hasOwn(FACES, given.faces) ? given.faces : DEFAULT_FACES,
        unmetDie: given.unmetDie === true,
    };
}

/** Settings of a view or ctx (a function or an object), read as the cast uses them. */
export function settingsOf(source) {
    let value = source;
    if (typeof source === 'function') {
        try { value = source(); } catch { value = null; }
    }
    return castSettings(value);
}

/** Whether the feature is on (`source.feature` when the host has it), else on. */
export function featureOn(source) {
    if (typeof source?.feature !== 'function') return true;
    try {
        return source.feature(FEATURE) !== false;
    } catch {
        return true;
    }
}

/** Whether the cast works now: the feature is on and the reader has not switched it off in its settings. */
export const castOn = source => featureOn(source) && settingsOf(source?.settings).on;
