// Story Director v2, world: the upcoming-days setting, its default and its ceiling.

import { isInt } from './shared-text.js';

export const DEFAULT_UPCOMING_DAYS = 30;
export const MAX_UPCOMING_DAYS = 365;

/** The upcoming setting (story days ahead), clamped. */
export function upcomingDaysOf(tools) {
    let value;
    try { value = typeof tools?.settings === 'function' ? tools.settings()?.upcomingDays : undefined; } catch { value = undefined; }
    return isInt(value) ? Math.min(MAX_UPCOMING_DAYS, Math.max(1, value)) : DEFAULT_UPCOMING_DAYS;
}
