// Decides why a reply is skipped (fight, rest, jump, quiet, no clock) and whether a rest happened since the last roll.

import { JUMP_MINUTES } from './limits.js';
import { isInt, isRecord } from './shared-guards.js';

export const SKIP_REASONS = Object.freeze(['fight', 'rest', 'jump', 'quiet', 'clock']);

/**
 * Why a reply is skipped (no roll, no receipt, no tail line), or '' for a rolled reply. `jumpMinutes`: story minutes since the
 * last reply (null when unknown); `clock`: the story minute now (null while the clock is not set).
 */
export function skipReason({ fight = false, rested = false, jumpMinutes = null, quiet = false, clock = null } = {}) {
    if (fight) return 'fight';
    if (rested) return 'rest';
    if (isInt(jumpMinutes) && jumpMinutes >= JUMP_MINUTES) return 'jump';
    if (quiet) return 'quiet';
    if (!isInt(clock)) return 'clock';
    return '';
}

// An explicit rest: a data module's last full rest (`rested-at`, the clock or clock + 1) falls after the last roll's clock.
export function restedSince(state, from, now) {
    const instances = state?.domains?.dataModules?.instances;
    if (!isInt(from) || !isInt(now) || !isRecord(instances)) return false;
    const marks = item => [item?.chat, ...Object.values(isRecord(item?.characters) ? item.characters : {})].map(part => part?.fields?.['rested-at']);
    return Object.values(instances).some(item => marks(item).some(at => isInt(at) && at > from && at <= now + 1));
}
