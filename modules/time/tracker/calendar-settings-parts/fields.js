// Story Director v2, tracker part: the calendar setting keys and the fields the game's or Gregorian calendar shows.

import { PRESETS } from '../../calendar.js';
import { GAME_PRESET, LEGACY_PACK_PRESET } from '../time-parts/constants.js';

export const CALENDAR_KEYS = Object.freeze({
    preset: 'tracker.calendar.preset',
    era: 'tracker.calendar.era',
    months: 'tracker.calendar.months',
    leapYears: 'tracker.calendar.leapYears',
    week: 'tracker.calendar.week',
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The game's calendar (`packCalendarOf`'s answer) as the settings fields, or null without one. */
export function packCalendarFields(calendar) {
    if (!isRecord(calendar) || !Array.isArray(calendar.months) || !calendar.months.length) return null;
    return {
        era: String(calendar.era ?? ''),
        months: calendar.months.map(month => ({ name: String(month?.name ?? ''), days: Number(month?.days) })),
        leapYears: calendar.leapYears === true,
        week: Array.isArray(calendar.week) ? calendar.week.join(', ') : '',
    };
}

/** The built-in Gregorian calendar as the settings fields. */
export function gregorianFields() {
    const g = PRESETS.gregorian;
    return { era: String(g.era ?? ''), months: structuredClone(g.months), leapYears: g.leapYears === true, week: Array.isArray(g.week) ? g.week.join(', ') : String(g.week ?? '') };
}

/** A calendar field's `readOnly`: true while the stored Calendar choice is game (the default; format 3 stored `pack`). */
export const calendarReadOnly = values => [undefined, null, GAME_PRESET, LEGACY_PACK_PRESET].includes(values?.[CALENDAR_KEYS.preset]);
