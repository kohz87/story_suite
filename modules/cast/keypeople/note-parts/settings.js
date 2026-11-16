// Story Director v2, part **keypeople**: reads the feature switch and the token budget setting.

import { DEFAULT_TOKENS, FEATURE, isInt } from '../domain.js';

/** The `tokens` setting: a whole number from 0 (nothing is told), no upper limit; else the default. */
export function tokensOf(settings) {
    const value = settings?.tokens;
    return isInt(value) && value >= 0 ? value : DEFAULT_TOKENS;
}

/** Whether the feature is on (`source.feature` when the host has it), else on. */
export function keyPeopleOn(source) {
    if (typeof source?.feature !== 'function') return true;
    try {
        return source.feature(FEATURE) !== false;
    } catch {
        return true;
    }
}
