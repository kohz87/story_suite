// A member's whole soak from their VIT and what their gear soaks (the Party tab's rule): VIT + gear + a stance's extra, 1 to 50 (percent of damage).

import { GEAR } from './constants.js';

/** `soakTotal(vit, gearTotal, extra)`: VIT plus the gear's soak plus `extra` (a stance), held to 1…GEAR.soak.max. */
export function soakTotal(vit, gear = 0, extra = 0) {
    const sum = [vit, gear, extra].reduce((total, n) => total + (Number.isFinite(n) ? Math.trunc(n) : 0), 0);
    return Math.max(1, Math.min(GEAR.soak.max, sum));
}
