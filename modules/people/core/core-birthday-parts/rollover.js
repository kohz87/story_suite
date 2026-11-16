/* NPC State Delta the deterministic birthday rollover of age and apparent age. */
import { normalizeNpcBirthday, reanchorDerivedBirthYearFromAge } from '../../birthday/birthday.js';
import { normalizeCalendarDate } from '../../legacy/calendar.js';
import * as mechanics from '../core-mechanics.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';
import { npcBirthdayNarrated } from './birthday-claims.js';
import { birthdayPromptSource } from './birthday-source.js';

export function exactStoredAge(value) {
    const text = String(value ?? '').trim();
    return /^\d{1,3}$/.test(text) ? Number(text) : null;
}

function compactApparentAgeNumber(value) {
    const match = String(value ?? '').trim().match(/^~?(\d{1,3})$/);
    return match ? Number(match[1]) : null;
}

export function sameCalendarBirthday(a, b, calendar) {
    const left = normalizeCalendarDate(a, calendar);
    const right = normalizeCalendarDate(b, calendar);
    if (!left || !right) return false;
    if (left.era && right.era && mechanics.normalizeName(left.era) !== mechanics.normalizeName(right.era)) return false;
    return mechanics.normalizeName(left.month) === mechanics.normalizeName(right.month) && left.day === right.day;
}

// Apparent age follows chronology from a fixed reference point instead of accumulating deltas:
// apparent = reference apparent + (chronological age - reference age). A dated scene that moves
// backward (a flashback, a corrected typo) therefore undoes exactly what a forward jump carried.
// `result` records the value this carry produced; when anything else later changes the apparent
// age (a scan, a manual edit, an import) it no longer matches and the reference restarts there.
function validApparentAgeAnchor(anchor, apparent) {
    return Boolean(anchor && typeof anchor === 'object'
        && Number.isInteger(anchor.age) && Number.isInteger(anchor.apparent) && anchor.result === apparent);
}

function carriedApparentAge(previousRaw, npc, previousAge, targetAge) {
    const apparent = compactApparentAgeNumber(previousRaw.apparentAge ?? npc.apparentAge);
    if (apparent === null) return null;
    const anchor = validApparentAgeAnchor(previousRaw.apparentAgeAnchor, apparent)
        ? previousRaw.apparentAgeAnchor
        : { age: previousAge, apparent };
    const result = anchor.apparent + (targetAge - anchor.age);
    // A long-lived NPC seen far in the past cannot look younger than an infant; keep what is
    // shown and the reference, so returning to the present restores it unchanged.
    if (result < 1) return { apparentAge: npc.apparentAge, apparentAgeAnchor: { age: anchor.age, apparent: anchor.apparent, result: apparent } };
    return { apparentAge: `~${result}`, apparentAgeAnchor: { age: anchor.age, apparent: anchor.apparent, result } };
}

export function applyDeterministicBirthdayRollover(npc, previousRaw, ordinaryUpdate, options, calendar, referenceDate) {
    if (!npc || !previousRaw || !referenceDate || isTerminalNpcDeath(npc)) return npc;
    const manualFields = Array.isArray(npc.manualProfileFields) ? npc.manualProfileFields : [];
    if (manualFields.includes('age')) return npc;
    const exactBirthday = sameCalendarBirthday(npc.birthDate, referenceDate, calendar);

    const previousAge = exactStoredAge(previousRaw.age);
    if (previousAge === null) return npc;
    const currentAge = exactStoredAge(npc.age);
    const calendarAge = Number.isInteger(npc.calendarAge) ? npc.calendarAge : null;

    const previousBirthDate = normalizeCalendarDate(
        previousRaw.birthDate ?? previousRaw.birth_date ?? previousRaw.birthday,
        calendar,
    );
    const previousHadYear = previousBirthDate?.year !== null && previousBirthDate?.year !== undefined;
    const incomingBirthday = ordinaryUpdate?.birthDate ?? ordinaryUpdate?.birth_date ?? ordinaryUpdate?.birthday;
    const birthdayEstablishedNow = Boolean(incomingBirthday)
        && ['establish', 'set', 'update', 'refine', 'correct', 'correction']
            .includes(String(ordinaryUpdate?.birthDateState ?? ordinaryUpdate?.birth_date_state ?? '').trim().toLowerCase());
    const ageState = String(ordinaryUpdate?.ageState ?? ordinaryUpdate?.age_state ?? '').trim().toLowerCase();
    const correctedAge = ageState === 'correct' || ageState === 'correction';
    const apparentState = String(ordinaryUpdate?.apparentAgeState ?? ordinaryUpdate?.apparent_age_state ?? '').trim().toLowerCase();
    const apparentCarries = !manualFields.includes('apparentAge') && apparentState !== 'evolve';
    // Only an unchanged full (year-bearing) birth date proves elapsed chronology, and only that
    // calendar arithmetic may carry into apparent age.
    const currentBirthDate = normalizeCalendarDate(npc.birthDate, calendar);
    const sameFullBirthDate = previousHadYear && currentBirthDate?.year === previousBirthDate.year
        && sameCalendarBirthday(currentBirthDate, previousBirthDate, calendar);
    const provenChronology = sameFullBirthDate && !birthdayEstablishedNow && !correctedAge && calendarAge !== null;
    if (provenChronology && calendarAge < previousAge) {
        // Chronology moved backward (already applied to age above); apparent age follows it back.
        if (!apparentCarries) return npc;
        const carried = carriedApparentAge(previousRaw, npc, previousAge, calendarAge);
        return carried ? { ...npc, ...carried } : npc;
    }
    if (!exactBirthday && (!provenChronology || calendarAge <= previousAge)) return npc;
    let targetAge = calendarAge !== null && calendarAge > previousAge ? calendarAge : currentAge;
    // Only a birthday narrated about this NPC counts; another NPC's birthday on the same date does not.
    const narratedBirthday = npcBirthdayNarrated(npc, birthdayPromptSource(options));

    // Compatibility recovery for an existing yearless birthday: if the story has reached that
    // exact stored birthday and explicitly presents it as a birthday/nameday, the accepted age
    // is the pre-birthday baseline. Advance once, then anchor the derived year so repeated scans
    // on the same day are idempotent. A birthday first established in this same scan is excluded.
    if (exactBirthday && !previousHadYear && !birthdayEstablishedNow && !correctedAge && narratedBirthday
        && (targetAge === null || targetAge <= previousAge)) {
        targetAge = previousAge + 1;
    }

    if (targetAge === null || targetAge <= previousAge) return npc;
    let next = { ...npc, age: String(targetAge), updatedAt: Date.now() };
    if (next.birthDateYearSource === 'derived'
        && (!Number.isInteger(next.calendarAge) || next.calendarAge < targetAge)) {
        next = reanchorDerivedBirthYearFromAge(next, calendar, referenceDate);
        next.age = String(targetAge);
    }

    if (apparentCarries) {
        const carried = carriedApparentAge(previousRaw, npc, previousAge, targetAge);
        if (carried) Object.assign(next, carried);
    }
    return normalizeNpcBirthday(next, calendar, referenceDate);
}
