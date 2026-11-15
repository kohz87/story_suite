// NPC birthday normalizing: generated fallback, calendar age, missing-year anchoring and re-anchoring.
import {
    calendarFingerprint,
    deriveAgeFromBirthDate,
} from '../calendar.js';
import { activeOrProvided, groundedReferenceDate } from './shared-config.js';
import { normalizedIdentity, exactAge } from './shared-compare.js';
import { normalizeBirthDate, formatBirthDate, normalizeStoredBirthDate } from './date.js';
import { deterministicBirthday, deriveBirthDateFromAge } from './derive.js';

const BIRTH_DATE_SOURCES = Object.freeze(['generated', 'established']);
const BIRTH_YEAR_SOURCES = Object.freeze(['', 'derived', 'established']);

function birthdaySeed(npc = {}) {
    const id = String(npc?.id || '').trim();
    return id || normalizedIdentity(npc?.name || '');
}

function generatedBirthdayFor(npc = {}, config = undefined) {
    const calendar = activeOrProvided(config);
    const generated = deterministicBirthday(birthdaySeed(npc), calendar);
    return {
        birthDate: generated,
        birthDateSource: generated ? 'generated' : '',
        birthDatePrecision: generated ? 'month-day' : '',
        birthDateYearSource: '',
        birthDateCalendarFingerprint: generated ? calendarFingerprint(calendar) : '',
        birthDateReason: '',
        birthDateSourceMessageId: null,
    };
}

function calculateCalendarAge(npc = {}, config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const current = groundedReferenceDate(calendar, referenceDate);
    if (!current) return null;
    const age = deriveAgeFromBirthDate(npc.birthDate, current, calendar);
    return Number.isInteger(age) ? age : null;
}

function anchorMissingBirthYear(npc = {}, config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const current = groundedReferenceDate(calendar, referenceDate);
    const age = exactAge(npc.age);
    const date = normalizeBirthDate(npc.birthDate, calendar);
    if (!current || age === null || !date || date.year !== null) return npc;
    const derived = deriveBirthDateFromAge(date, String(age), current, calendar);
    if (!derived) return npc;
    return {
        ...npc,
        birthDate: derived,
        birthDatePrecision: 'full',
        birthDateYearSource: 'derived',
    };
}

export function normalizeNpcBirthday(npc = {}, config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const rawDate = normalizeStoredBirthDate(npc?.birthDate ?? npc?.birth_date ?? npc?.birthday, calendar);
    const rawSource = String(npc?.birthDateSource ?? npc?.birth_date_source ?? '').trim().toLowerCase();
    const source = BIRTH_DATE_SOURCES.includes(rawSource) ? rawSource : (rawDate ? 'established' : '');
    const storedFingerprint = String(npc?.birthDateCalendarFingerprint ?? npc?.birth_date_calendar_fingerprint ?? '').trim();
    const activeFingerprint = calendarFingerprint(calendar);

    let next;
    if (!rawDate) {
        next = { ...npc, ...generatedBirthdayFor(npc, calendar) };
    } else if (source === 'generated' && storedFingerprint && storedFingerprint !== activeFingerprint) {
        // Generated dates belong to the configured calendar. A deliberate calendar change
        // deterministically remaps them; established story dates are never remapped this way.
        next = { ...npc, ...generatedBirthdayFor(npc, calendar) };
    } else {
        const rawYearSource = String(npc?.birthDateYearSource ?? npc?.birth_date_year_source ?? '').trim().toLowerCase();
        let yearSource = BIRTH_YEAR_SOURCES.includes(rawYearSource) ? rawYearSource : '';
        if (rawDate.year !== null && !yearSource) yearSource = source === 'established' ? 'established' : 'derived';
        const rawSourceMessageId = npc?.birthDateSourceMessageId ?? npc?.birth_date_source_message_id;
        next = {
            ...npc,
            birthDate: rawDate,
            birthDateSource: source || 'established',
            birthDatePrecision: rawDate.year === null ? 'month-day' : 'full',
            birthDateYearSource: yearSource,
            birthDateCalendarFingerprint: storedFingerprint || activeFingerprint,
            birthDateReason: String(npc?.birthDateReason ?? npc?.birth_date_reason ?? '').trim().slice(0, 500),
            birthDateSourceMessageId: Number.isInteger(rawSourceMessageId) ? rawSourceMessageId : null,
        };
    }

    next = anchorMissingBirthYear(next, calendar, referenceDate);
    const calendarAge = calculateCalendarAge(next, calendar, referenceDate);
    next.calendarAge = calendarAge;
    next.birthDateDisplay = formatBirthDate(next.birthDate, calendar);
    return next;
}

export function effectiveChronologicalAge(npc = {}, config = undefined, referenceDate = null) {
    const normalized = normalizeNpcBirthday(npc, config, referenceDate);
    return Number.isInteger(normalized.calendarAge) ? String(normalized.calendarAge) : String(normalized.age ?? '').trim();
}

export function reanchorDerivedBirthYearFromAge(npc = {}, config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const current = groundedReferenceDate(calendar, referenceDate);
    const next = normalizeNpcBirthday(npc, calendar, current);
    if (next.birthDateYearSource !== 'derived' || exactAge(next.age) === null || !current) return next;
    const partial = { ...next.birthDate, year: null };
    const derived = deriveBirthDateFromAge(partial, next.age, current, calendar);
    if (!derived) return next;
    return normalizeNpcBirthday({
        ...next,
        birthDate: derived,
        birthDatePrecision: 'full',
        birthDateYearSource: 'derived',
    }, calendar, current);
}

