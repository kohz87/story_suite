// Story Director v2, part **arc**: the Director judge's record and the arc's world note as the accept command keeps them (from the payload the controller sends; both optional).

import { flat } from '../plan.js';
import { WORLD_NOTE_POINTS } from '../domain-parts/world-constants.js';

const count = value => (Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 99) : 0);

/** `{ judge?: { calls, accept, reshape, refuse, fell }, world?: text }` from an accept payload: only what is there, whole numbers and cut text. */
export function judgeRecord(payload) {
    const raw = payload?.judge && typeof payload.judge === 'object' && !Array.isArray(payload.judge) ? payload.judge : null;
    const world = flat(payload?.world, WORLD_NOTE_POINTS);
    return {
        ...(raw ? { judge: { calls: count(raw.calls), accept: count(raw.accept), reshape: count(raw.reshape), refuse: count(raw.refuse), fell: raw.fell === true } } : {}),
        ...(world ? { world } : {}),
    };
}
