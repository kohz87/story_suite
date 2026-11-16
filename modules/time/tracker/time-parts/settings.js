// The part's settings: their defaults, the longest-jump setting in minutes, and settings read from a source.

import { PRESETS } from '../../calendar.js';
import { DEFAULTS } from '../../../atlas/relevance.js';
import { PACK_PRESET } from './constants.js';
import { DAY_MINUTES, MAX_JUMP_DAYS } from './limits.js';

/** The part's settings defaults: v1's calendar and relevance defaults, plain copies. */
export function settingsDefaults() {
    return {
        calendar: { ...structuredClone(PRESETS.gregorian), preset: PACK_PRESET },
        dormantReplies: DEFAULTS.dormantReplies,
        dormantDays: DEFAULTS.dormantDays,
        dueSoonDays: DEFAULTS.dueSoonDays,
        maxJump: MAX_JUMP_DAYS,
        // The Director note's Elsewhere line (scene.js DEFAULT_ELSEWHERE) and NPC initiative's cooldown
        // (initiative.js DEFAULT_COOLDOWN).
        elsewhere: 2,
        initiativeCooldown: 2,
    };
}

/** The `maxJump` setting in minutes: a whole number of days, 1 or more, else the default. */
export function maxJumpMinutes(settings) {
    const days = settings?.maxJump;
    return (Number.isSafeInteger(days) && days >= 1 ? days : MAX_JUMP_DAYS) * DAY_MINUTES;
}

/** The module's settings as handed to a handler or a view: a function, an object, or nothing. */
export function settingsFrom(source) {
    const value = typeof source === 'function' ? source() : source;
    return { ...settingsDefaults(), ...(value && typeof value === 'object' ? value : {}) };
}
