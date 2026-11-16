// Story day and time-of-day helpers for cast minutes.

import { isInt } from './shared-checks.js';

export const DAY = 1440;

/** The story day a minute falls on. */
export const dayOf = minutes => Math.floor(minutes / DAY);

/** The part of the day a minute falls in, in words ('night', 'dawn', 'morning', 'midday', 'afternoon', 'evening'). */
export function timeOfDay(minutes) {
    if (!isInt(minutes)) return '';
    const hour = Math.floor((((minutes % DAY) + DAY) % DAY) / 60);
    if (hour < 5 || hour >= 22) return 'night';
    if (hour < 8) return 'dawn';
    if (hour < 12) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 17) return 'afternoon';
    return 'evening';
}
