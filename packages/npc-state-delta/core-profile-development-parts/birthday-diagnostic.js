/* Records why a birthday or age change was applied or held, as a birthday receipt in a scan report. */
import { normalizeCalendarDate } from '../calendar.js';
import { birthdayPromptSource, exactStoredAge, sameCalendarBirthday } from '../core-birthday.js';
import { birthdayEvidenceInText } from '../birthday.js';
export function recordBirthdayDiagnostic(report, beforeNpc, afterNpc, ordinaryUpdate, options, calendar, referenceDate) {
    if (!report || !beforeNpc || !afterNpc || !referenceDate) return;
    const birthdayMatched = sameCalendarBirthday(afterNpc.birthDate, referenceDate, calendar);
    const incomingBirthday = ordinaryUpdate?.birthDate ?? ordinaryUpdate?.birth_date ?? ordinaryUpdate?.birthday;
    const birthDateState = String(ordinaryUpdate?.birthDateState ?? ordinaryUpdate?.birth_date_state ?? '').trim().toLowerCase();
    const establishedNow = Boolean(incomingBirthday)
        && ['establish', 'set', 'update', 'refine', 'correct', 'correction'].includes(birthDateState);
    const narratedBirthday = birthdayEvidenceInText(birthdayPromptSource(options));
    const manualFields = Array.isArray(afterNpc.manualProfileFields) ? afterNpc.manualProfileFields : [];
    const previousAge = String(beforeNpc.age ?? '').trim();
    const age = String(afterNpc.age ?? '').trim();
    const previousApparentAge = String(beforeNpc.apparentAge ?? '').trim();
    const apparentAge = String(afterNpc.apparentAge ?? '').trim();
    const oldExact = exactStoredAge(previousAge);
    const newExact = exactStoredAge(age);
    const delta = oldExact !== null && newExact !== null ? newExact - oldExact : 0;
    const ageState = String(ordinaryUpdate?.ageState ?? ordinaryUpdate?.age_state ?? '').trim().toLowerCase();
    const birthdaySupplied = Boolean(incomingBirthday);
    if (!birthdayMatched && !birthdaySupplied && !['advance', 'correct', 'correction'].includes(ageState) && delta === 0) return;

    let reason = 'no-rollover';
    if (manualFields.includes('age')) reason = 'manual-age-lock';
    else if (delta > 0) reason = 'calendar-rollover';
    else if (establishedNow && birthdayMatched) reason = 'first-establishment-guard';
    else if (birthdayMatched && narratedBirthday) reason = 'birthday-held';
    else if (ageState === 'correct' || ageState === 'correction') reason = 'age-correction-held';
    else if (ageState === 'advance') reason = 'age-advance-held';

    report.birthdayDiagnostics = Array.isArray(report.birthdayDiagnostics) ? report.birthdayDiagnostics : [];
    report.birthdayDiagnostics.push({
        npcId: String(afterNpc.id || ''),
        outcome: delta > 0 ? 'advance' : 'hold',
        reason,
        birthdayMatched,
        establishedNow,
        birthdaySupplied,
        birthDateState,
        narratedBirthday,
        ageState,
        ageLocked: manualFields.includes('age'),
        apparentAgeLocked: manualFields.includes('apparentAge'),
        previousAge,
        age,
        previousApparentAge,
        apparentAge,
        delta,
        previousBirthDate: normalizeCalendarDate(beforeNpc.birthDate, calendar),
        birthDate: normalizeCalendarDate(afterNpc.birthDate, calendar),
        birthDateYearSource: String(afterNpc.birthDateYearSource || ''),
        calendarAge: Number.isInteger(afterNpc.calendarAge) ? afterNpc.calendarAge : null,
        referenceDate: normalizeCalendarDate(referenceDate, calendar),
    });
    if (report.birthdayDiagnostics.length > 32) report.birthdayDiagnostics.splice(0, report.birthdayDiagnostics.length - 32);
}
