// Computes boarding days, leg days, rest days, and overnight stops.

import { nonNegative, positive, tidy } from '../util.js';
import { DEFAULT_RULES, EPSILON, MODERN_RULES, SELF_MODES, WATER_MODES } from '../pack.js';

/** Days spent boarding on a modern code: check-in for a flight, the wait for a train. */
export function boardDays(pack, code) {
    if (pack?.era !== 'modern') return 0;
    return tidy((nonNegative(pack.paces?.[code]?.boardHours) ?? 0) / 24);
}

/** Days for one edge: `ceil(km / rate / roundUpTo) * roundUpTo`; null for a bad rate. */
export function legDays(km, rate, rules = DEFAULT_RULES) {
    if (!(rate > 0) || !(km >= 0)) return null;
    // Modern: km an hour, rounded up to the quarter hour (or the pack's step), in days.
    if (rules?.unit === 'hour') {
        const step = rules.roundUpTo ?? MODERN_RULES.roundUpTo;
        const hours = step > 0 ? Math.ceil(km / rate / step - EPSILON) * step : km / rate;
        return tidy(hours / 24);
    }
    const step = rules?.roundUpTo ?? DEFAULT_RULES.roundUpTo;
    if (!(step > 0)) return km / rate;
    return tidy(Math.ceil(km / rate / step - EPSILON) * step);
}

export function restDaysFor(mode, activeDays, rules = DEFAULT_RULES) {
    // Modern: whoever drives, rides or walks stops for the night after driveHoursPerDay; trains,
    // buses, ferries and planes go on. Returned in days, like a rest day.
    if (rules?.unit === 'hour') return tidy(overnights(mode, activeDays, rules) * (24 - driveHours(rules)) / 24);
    const every = rules?.restDayEvery ?? DEFAULT_RULES.restDayEvery;
    if (mode === 'courier' || !(every > 0) || !(activeDays > 0)) return 0;
    if (WATER_MODES.includes(mode) && !rules?.crewedWaterRest) return 0;
    // Flight rests like land travel: the beasts tire.
    return Math.floor((activeDays - EPSILON) / every);
}

function driveHours(rules) {
    return Math.min(24, positive(rules?.driveHoursPerDay) ?? MODERN_RULES.driveHoursPerDay);
}

/** Nights a modern trip stops for: 0 for public transport and trips within a day's driving. */
export function overnights(mode, activeDays, rules = MODERN_RULES) {
    if (rules?.unit !== 'hour' || !SELF_MODES.includes(mode) || !(activeDays > 0)) return 0;
    const hours = driveHours(rules);
    if (hours >= 24) return 0;
    return Math.max(0, Math.ceil(activeDays * 24 / hours - EPSILON) - 1);
}
