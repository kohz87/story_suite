// The scan merge: continuity merge plus per-NPC birthday, profile-development and field-change finalization.
import * as continuity from '../continuity-core.js';
import * as mechanics from '../core-mechanics.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';
import { lockAwayNpcs } from '../src/key-people.js';
import { getActiveCalendarConfig, normalizeCalendarDate, withStoryDateMemo } from '../calendar.js';
import { applyNpcBirthdayUpdate, mergeNpcBirthdayKnowledge, normalizeNpcBirthday, reanchorDerivedBirthYearFromAge } from '../birthday.js';
import { birthdayUpdateGrounded, withAppearanceDerivedApparentAge, birthdayUpdateRow, stampFieldChanges, calendarReference, applyDeterministicBirthdayRollover } from '../core-birthday.js';
import { prepareProfileDevelopmentState, appearanceUpdateForNpc, durableUpdateForNpc, recordAppearanceDiagnostic, recordSecondaryProfileDiagnostics, recordBirthdayDiagnostic } from '../core-profile-development.js';
import { finalizeProfileDevelopment } from '../core-profile-finalize.js';
import { storyDayFromText } from './calendar-days.js';
import { normalizeNpcRecord } from './npc-records.js';

// A scan's merge. `awayNpcIds` (the dossiers of key people who are away, from Story Director): their stable
// profile fields and custom fields are held as if locked for this merge only (src/key-people.js); nothing of
// the hold is stored, and without it the merge is exactly as before.
export function mergeScanResult(state, scanResult, rawOptions = {}) {
    return withStoryDateMemo(() => mergeScanResultInPass(state, scanResult, rawOptions));
}

function mergeScanResultInPass(state, scanResult, rawOptions = {}) {
    const hold = lockAwayNpcs(state, rawOptions.awayNpcIds);
    if (!hold) return mergeScanResultHeld(state, scanResult, rawOptions);
    const result = mergeScanResultHeld(hold.state, scanResult, rawOptions);
    result.state.npcs = hold.restore(result.state.npcs);
    return result;
}

function mergeScanResultHeld(state, scanResult, rawOptions = {}) {
    // Story day of the scanned message (its dated World State), unless the caller already resolved
    // it (carrying the last dated message forward). Undated chats leave it null and use turns.
    const supplied = rawOptions.storyDay;
    const suppliedDay = supplied === null || supplied === undefined || supplied === '' ? NaN : Number(supplied);
    const options = { ...rawOptions, storyDay: Number.isInteger(suppliedDay) ? suppliedDay : storyDayFromText(rawOptions.calendarSource) };
    const profilePrepared = prepareProfileDevelopmentState(state, scanResult, options);
    const sourceState = profilePrepared.state;
    const calendar = getActiveCalendarConfig();
    const reference = calendarReference(options, calendar);
    const referenceDate = reference.date;
    const previousRaw = Array.isArray(sourceState?.npcs) ? sourceState.npcs : [];
    const previous = previousRaw.map(raw => normalizeNpcBirthday(continuity.normalizeNpcRecord(raw), calendar, referenceDate));
    const profileUpdates = Array.isArray(scanResult?.profileUpdates) ? scanResult.profileUpdates
        : (Array.isArray(scanResult?.profile_updates) ? scanResult.profile_updates : []);
    const continuityOptions = { ...options, developmentSingleTarget: profileUpdates.length === 1 };
    const result = continuity.mergeScanResult(sourceState, scanResult, continuityOptions);
    const ordinary = Array.isArray(scanResult?.npcs) ? scanResult.npcs : [];
    const diagnosticNpcRegistry = (result.state.npcs || []).map(npc => structuredClone(npc));

    result.state.npcs = (result.state.npcs || []).map(rawNpc => {
        const sources = mechanics.matchingNpcRecords(rawNpc, previous);
        const rawSources = mechanics.matchingNpcRecords(rawNpc, previousRaw);
        const ordinaryUpdate = birthdayUpdateRow(
            ordinary.find(raw => mechanics.scanRowMatchesNpc(raw, rawNpc)),
            profileUpdates.find(raw => mechanics.scanRowMatchesNpc(raw, rawNpc)),
        );
        let npc = normalizeNpcBirthday(rawNpc, calendar, referenceDate);
        if (ordinaryUpdate && birthdayUpdateGrounded(npc, ordinaryUpdate, options.developmentContext, calendar, referenceDate)) {
            npc = applyNpcBirthdayUpdate(npc, ordinaryUpdate, { ...options, calendarConfig: calendar, referenceDate });
        }
        const ageState = String(ordinaryUpdate?.ageState ?? ordinaryUpdate?.age_state ?? '').trim().toLowerCase();
        if ((ageState === 'advance' || ageState === 'correct') && npc.birthDateYearSource === 'derived'
            && sources.some(source => String(source.age) !== String(npc.age))) {
            npc = reanchorDerivedBirthYearFromAge(npc, calendar, referenceDate);
        }
        if (sources.length) npc = mergeNpcBirthdayKnowledge(sources, npc, calendar, referenceDate);

        // A grounded full current date turns a full birth date into deterministic chronology.
        // Chronological age is local arithmetic; the birthday rollover below may carry an already-numeric
        // apparent-age estimate by the same proven delta without using it to derive chronology.
        if (!(npc.manualProfileFields || []).includes('age') && !isTerminalNpcDeath(npc)
            && referenceDate && Number.isInteger(npc.calendarAge) && normalizeCalendarDate(npc.birthDate, calendar)?.year !== null
            && !(reference.fallback && /^\d+$/.test(String(npc.age)) && npc.calendarAge < Number(npc.age))) {
            npc.age = String(npc.calendarAge);
        }
        const beforeDiagnosticNpc = rawSources[0] ? normalizeNpcBirthday(continuity.normalizeNpcRecord(rawSources[0]), calendar, referenceDate) : null;
        npc = applyDeterministicBirthdayRollover(
            npc,
            rawSources[0] || null,
            ordinaryUpdate,
            options,
            calendar,
            referenceDate,
        );
        const appearanceUpdate = appearanceUpdateForNpc(scanResult, npc);
        if (beforeDiagnosticNpc) {
            // Appearance is resolved by continuity before Personality/Speech finalization. Record
            // it first so adding observability does not change legacy development-row ordering.
            recordAppearanceDiagnostic(result.report, beforeDiagnosticNpc, npc, appearanceUpdate, continuityOptions, diagnosticNpcRegistry);
        }
        npc = finalizeProfileDevelopment(npc, profilePrepared.plans.get(String(npc.id || '')), continuityOptions, result.report);
        const durableUpdate = durableUpdateForNpc(scanResult, npc);
        if (beforeDiagnosticNpc) {
            recordSecondaryProfileDiagnostics(result.report, beforeDiagnosticNpc, npc, durableUpdate, continuityOptions, diagnosticNpcRegistry);
            recordBirthdayDiagnostic(result.report, beforeDiagnosticNpc, npc, ordinaryUpdate, options, calendar, referenceDate);
        }
        const finalNpc = withAppearanceDerivedApparentAge(npc, ordinaryUpdate?.appearance || rawNpc.appearance);
        const changeBase = rawSources[0] ? normalizeNpcRecord(rawSources[0]) : null;
        return stampFieldChanges(changeBase, finalNpc, Math.trunc(Number(result.state?.turn ?? sourceState?.turn)), options.storyDay,
            Number.isInteger(options.sourceMessageId) ? options.sourceMessageId : null);
    });
    if (reference.extracted) {
        result.report = {
            ...(result.report || {}),
            calendarReference: {
                source: 'world-state',
                raw: reference.extracted.raw,
                date: structuredClone(reference.extracted.date),
            },
        };
    }
    return result;
}
