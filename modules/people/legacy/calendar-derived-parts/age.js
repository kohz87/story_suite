/* Age and birth-date derivation against a reference story date. */

import { normalizeCalendarConfig, normalizeMonthKey } from '../calendar-config.js';
import { storyCurrentDate } from '../calendar-clock.js';
import { dateOrdinal, normalizeCalendarDate } from '../calendar-date.js';

export function deriveBirthDateFromAgeParts(birthDate, age, referenceDate = null, config = null) {
    const date = normalizeCalendarDate(birthDate, config);
    const current = normalizeCalendarDate(referenceDate || storyCurrentDate(config), config);
    const ageText = String(age ?? '').trim();
    if (!date || !current || current.year === null || !/^\d{1,3}$/.test(ageText)) return null;
    const exactAge = Number(ageText);
    if (date.era && current.era && normalizeMonthKey(date.era) !== normalizeMonthKey(current.era)) return null;
    const birthdayOrdinal = dateOrdinal(date, config);
    const currentOrdinal = dateOrdinal(current, config);
    if (birthdayOrdinal === null || currentOrdinal === null || exactAge < 0) return null;
    const year = current.year - exactAge - (currentOrdinal < birthdayOrdinal ? 1 : 0);
    return { ...date, era: date.era || current.era || normalizeCalendarConfig(config, { requireCurrentDate: false }).config.era, year };
}

export function deriveAgeFromBirthDate(birthDate, referenceDate = null, config = null) {
    const date = normalizeCalendarDate(birthDate, config);
    const current = normalizeCalendarDate(referenceDate || storyCurrentDate(config), config);
    if (!date || date.year === null || !current || current.year === null) return null;
    if (date.era && current.era && normalizeMonthKey(date.era) !== normalizeMonthKey(current.era)) return null;
    const birthdayOrdinal = dateOrdinal(date, config);
    const currentOrdinal = dateOrdinal(current, config);
    if (birthdayOrdinal === null || currentOrdinal === null) return null;
    const age = current.year - date.year - (currentOrdinal < birthdayOrdinal ? 1 : 0);
    return Number.isInteger(age) && age >= 0 ? age : null;
}
