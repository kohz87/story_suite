// Pack travel units, rate wording, and arrival tolerance helpers.

import { DAYS_TOLERANCE } from '../pack.js';

export function unitOf(pack) {
    return pack?.rules?.unit === 'hour' ? 'hour' : 'day';
}

export function rateWords(unit) {
    return unit === 'hour' ? 'km/h' : 'km a day';
}

// Pre-modern: half a day. Modern: a quarter hour, or a tenth of the trip when that is more.
export function toleranceFor(days, unit) {
    return unit === 'hour' ? Math.max(0.25 / 24, (days ?? 0) * 0.1) : DAYS_TOLERANCE;
}
