// Story Director v2, chronicle part: the digest feature switch, the guarded query call and the story-time read, shared by the digest parts. Pure.

import { DIGEST_FEATURE } from '../days.js';

export const isInt = value => Number.isSafeInteger(value);

/** Whether the digest feature is on: `ctx.feature` / `view.feature` when the host has them (F100), else on. */
export function digestOn(source) {
    if (typeof source?.feature !== 'function') return true;
    try {
        return source.feature(DIGEST_FEATURE) !== false;
    } catch {
        return true;
    }
}

export function ask(query, name, args) {
    if (typeof query !== 'function') return null;
    try {
        return query(name, args) ?? null;
    } catch {
        return null;
    }
}

export const minutesFrom = query => {
    const minutes = ask(query, 'director.time', {})?.minutes;
    return isInt(minutes) ? minutes : null;
};
