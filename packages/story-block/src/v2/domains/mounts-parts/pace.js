// The paces a party travels at: on foot, by default, and by kind of mount.

import { foldKey } from '../../../../../../core/text.js';

/** What a party without enough mounts does: km per day on foot. */
export const WALK_PACE = 20;

/** The pace of a kind with no entry below. */
export const DEFAULT_PACE = 30;

/** km per day, by kind. */
export const KIND_PACE = Object.freeze({ horse: 35, pony: 30, camel: 30, mule: 25, donkey: 20, ox: 15, cart: 18, wagon: 18 });

/** The pace a kind of mount goes at when a line gives none ("horses" is a horse; an unknown kind or none, 30). */
export function paceOfKind(kind) {
    const key = foldKey(kind);
    for (const form of [key, key.replace(/s$/, ''), key.replace(/es$/, ''), key === 'oxen' ? 'ox' : '']) {
        if (form && Object.hasOwn(KIND_PACE, form)) return KIND_PACE[form];
    }
    return DEFAULT_PACE;
}
