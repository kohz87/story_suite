/* NPC State Delta the birthday update row, the prompt source text and the story-date reference of a scan. */
import { currentCalendarDate, extractStructuredWorldDate, getActiveCalendarConfig, hostedStoryDate, normalizeCalendarDate } from '../calendar.js';

const BIRTHDAY_UPDATE_KEYS = ['birthDate', 'birth_date', 'birthday', 'birthDateState', 'birth_date_state', 'birthDateReason', 'birth_date_reason'];
function hasBirthdayUpdate(row) {
    return Boolean(row && typeof row === 'object' && (row.birthDate ?? row.birth_date ?? row.birthday));
}

// The scanner is told to put grounded durable facts in profileUpdates, so a narrated birthday for an
// existing NPC can arrive there instead of in its npcs delta. Accept it from either channel; the
// ordinary delta wins when both carry one, and the same establish/correct gate applies.
export function birthdayUpdateRow(ordinaryRow, profileRow) {
    if (hasBirthdayUpdate(ordinaryRow) || !hasBirthdayUpdate(profileRow)) return ordinaryRow;
    const birthday = Object.fromEntries(BIRTHDAY_UPDATE_KEYS.filter(key => key in profileRow).map(key => [key, profileRow[key]]));
    return { ...(ordinaryRow || {}), ...birthday };
}

export function birthdayPromptSource(options = {}) {
    return String(options?.transcript || options?.dossierText || options?.developmentContext || '');
}

// The story's date for a scan: a World State date in the scanned text (v1), else a given reference date,
// else (v2, hosted with Story Director) the story clock's date (calendar.js hostedStoryDate), else Delta's
// manual clock. `fallback` says no grounded date was found (the manual clock, or none).
export function calendarReference(options = {}, calendar = getActiveCalendarConfig()) {
    const extracted = extractStructuredWorldDate(options.calendarSource ?? birthdayPromptSource(options), calendar);
    const given = normalizeCalendarDate(options?.referenceDate, calendar) || hostedStoryDate(calendar);
    return {
        extracted,
        fallback: !extracted && !given,
        date: extracted?.date || given || currentCalendarDate(calendar),
    };
}
