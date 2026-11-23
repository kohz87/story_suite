// The active rule: Text RPG works in a chat when its feature is on and the RPG's is off.
import { FEATURE, RPG_FEATURE } from './constants.js';

/** True when `source` (a view, a ctx or the sdk: anything with `feature(id)`) has Text RPG on and the RPG off. */
export function active(source) {
    try {
        return source?.feature?.(FEATURE) === true && source?.feature?.(RPG_FEATURE) !== true;
    } catch {
        return false;
    }
}

/** Fails a command or a line quietly (FEATURE_OFF) when Text RPG is not active. */
export function requireActive(ctx) {
    if (!active(ctx)) ctx.fail('FEATURE_OFF', 'Text RPG is turned off (feature off).');
}
