// Applying a birthday update from the story and merging established birthdays between records.
import {
    calendarFingerprint,
    getActiveCalendarConfig,
} from '../calendar.js';
import { activeOrProvided, groundedReferenceDate } from './shared-config.js';
import { exactAge, sameDate, sameMonthDay } from './shared-compare.js';
import { normalizeBirthDate } from './date.js';
import { deriveBirthDateFromAge } from './derive.js';
import { normalizeBirthDateState } from './scan-input.js';
import { normalizeNpcBirthday } from './normalize.js';

export const PACK_BIRTHDAY_REASON = 'From the story pack.';

export function applyNpcBirthdayUpdate(npc = {}, rawUpdate = null, options = {}) {
    const calendar = options.calendarConfig ?? getActiveCalendarConfig();
    const referenceDate = groundedReferenceDate(calendar, options.referenceDate);
    const next = normalizeNpcBirthday(npc, calendar, referenceDate);
    if (!rawUpdate || typeof rawUpdate !== 'object') return next;
    let incoming = normalizeBirthDate(rawUpdate.birthDate ?? rawUpdate.birth_date ?? rawUpdate.birthday, calendar);
    if (!incoming) return next;

    const state = normalizeBirthDateState(rawUpdate);
    if (state !== 'establish' && state !== 'correct') return next;
    const reason = String(rawUpdate.birthDateReason ?? rawUpdate.birth_date_reason ?? '').trim().slice(0, 500);
    const fromPack = next.birthDateReason === PACK_BIRTHDAY_REASON;   // a pack date is canon only until the story states one
    const currentEstablished = next.birthDateSource === 'established' && !fromPack;

    let incomingYearSource = incoming.year === null ? '' : 'established';
    if (incoming.year === null && referenceDate && exactAge(npc.age) !== null) {
        const derived = deriveBirthDateFromAge(incoming, npc.age, referenceDate, calendar);
        if (derived) {
            incoming = derived;
            incomingYearSource = 'derived';
        }
    }

    const exactMatch = sameDate(incoming, next.birthDate, calendar);
    const sameDay = sameMonthDay(incoming, next.birthDate, calendar);
    const existingHasYear = normalizeBirthDate(next.birthDate, calendar)?.year !== null;
    const incomingHasYear = incoming.year !== null;
    const authorityUpgrade = sameDay
        && incomingHasYear
        && (!existingHasYear || next.birthDateYearSource === 'derived')
        && incomingYearSource === 'established';

    const mayEstablish = state === 'establish'
        && (!currentEstablished || !next.birthDate || authorityUpgrade || exactMatch);
    const mayCorrect = state === 'correct';
    if (!mayCorrect && !mayEstablish) return next;

    return normalizeNpcBirthday({
        ...next,
        birthDate: incoming,
        birthDateSource: 'established',
        birthDatePrecision: incoming.year === null ? 'month-day' : 'full',
        birthDateYearSource: incomingYearSource,
        birthDateCalendarFingerprint: calendarFingerprint(calendar),
        birthDateReason: reason || (exactMatch && !fromPack ? next.birthDateReason : ''),
        birthDateSourceMessageId: Number.isInteger(options.sourceMessageId)
            ? options.sourceMessageId
            : next.birthDateSourceMessageId,
    }, calendar, referenceDate);
}

export function mergeNpcBirthdayKnowledge(sources = [], current = {}, config = undefined, referenceDate = null) {
    const calendar = activeOrProvided(config);
    const next = normalizeNpcBirthday(current, calendar, referenceDate);
    if (next.birthDateSource === 'established') return next;
    const established = (Array.isArray(sources) ? sources : [])
        .map(source => normalizeNpcBirthday(source, calendar, referenceDate))
        .find(source => source.birthDateSource === 'established' && source.birthDate);
    if (!established) return next;
    return normalizeNpcBirthday({
        ...next,
        birthDate: established.birthDate,
        birthDateSource: 'established',
        birthDatePrecision: established.birthDatePrecision,
        birthDateYearSource: established.birthDateYearSource,
        birthDateCalendarFingerprint: established.birthDateCalendarFingerprint,
        birthDateReason: established.birthDateReason,
        birthDateSourceMessageId: established.birthDateSourceMessageId,
    }, calendar, referenceDate);
}
