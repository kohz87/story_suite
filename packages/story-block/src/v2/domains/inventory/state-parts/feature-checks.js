// Asking whether the gear feature or another feature is on for a handler or view.

import { FEATURE } from './features.js';

// The gear switch lives in Settings → RPG and counts only while the RPG is on.
const RPG_FEATURE = 'story-block.rpg';

/** Whether the gear feature is on for this handler (or view): off unless the host says so (off by default, and only while the RPG is on). */
export function gearOn(ctx) {
    try {
        return typeof ctx?.feature === 'function' && ctx.feature(FEATURE.gear) === true && ctx.feature(RPG_FEATURE) === true;
    } catch {
        return false;
    }
}

/** Whether a feature is on for this handler (or view): on when the host has no Features API. */
export function featureOn(ctx, id) {
    try {
        return typeof ctx?.feature === 'function' ? ctx.feature(id) !== false : true;
    } catch {
        return true;
    }
}
