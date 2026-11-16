// Story Director v2, chronicle part: reading and re-deriving stored day digests. Pure.

import { slotValue } from '../../../../packages/story-director/src/v2/slot.js';
import { entriesByDay, rangeDays } from './day-entries.js';
import { factsOf } from './facts-fold.js';
import { isInt, isRecord } from './shared-values.js';
import { makeDigest } from './summary-digest.js';

/**
 * The day digests a chronicle keeps, by day number, as the day's facts stand now. A digest written
 * from the day's kept entries (`src`: their revisions) follows them: when a reply of that day is
 * deleted later (its entry goes with it), the digest is worked out again from the entries left
 * (followDigest), and a day none is left of is not there (the next digest drops it). Nothing of
 * this is stored: it is read from the state. `state` (the threads' stamps, for the quests) and
 * `currency` (the money's words in the line) are for a digest worked out again; without `state`
 * its quests stay as written.
 */
export function daysOf(chronicle, { state = null, currency = null } = {}) {
    const out = {};
    let byDay = null;
    let dayOfRev = null;
    for (const [key, stored] of Object.entries(isRecord(chronicle?.days) ? chronicle.days : {})) {
        const digest = slotValue(stored);
        if (!digest || !isInt(digest.day) || String(digest.day) !== key) continue;
        if (digest.brief || !Array.isArray(digest.src) || !digest.src.length) {
            out[key] = digest;
            continue;
        }
        byDay ??= entriesByDay(chronicle);
        const src = new Set(digest.src);
        const left = (byDay.get(digest.day) ?? []).filter(item => src.has(item.rev));
        if (!left.length) continue;
        if (left.length === src.size) {
            out[key] = digest;
            continue;
        }
        dayOfRev ??= rangeDays(byDay);
        out[key] = followDigest(digest, left, { state, currency, dayOfRev });
    }
    return out;
}

/**
 * `digest` worked out again from `left` (the day's entries still kept, `[{ rev, entry }]` in order):
 * its facts and line from them, its date and `made` as written, its quests from `state` when given.
 */
export function followDigest(digest, left, { state = null, currency = null, dayOfRev = () => null } = {}) {
    const facts = factsOf(left.map(item => item.entry), { state, day: digest.day, dayOfRev });
    const quests = state ? facts.quests : digest.quests;
    return makeDigest(digest.day, { ...facts, quests }, { date: digest.date, currency, made: digest.made, revs: facts.revs, src: left.map(item => item.rev) });
}

/**
 * The days kept, oldest first (daysOf's options). Only the days `written.days` lists are read: it is what the last digest left. A
 * digest stored for another day is a leftover (the clock went back past it, or the block that dropped it for the keep cap was
 * deleted in the middle), so it is not read. `all: true` (the digest command, which writes `written` itself) keeps every stored one.
 */
export function orderedDays(chronicle, options) {
    const listed = options?.all ? null : writtenOf(chronicle)?.days;
    const left = Array.isArray(listed) ? new Set(listed) : null;
    return Object.values(daysOf(chronicle, options)).filter(digest => !left || left.has(digest.day)).sort((a, b) => a.day - b.day);
}

/** `chronicle.written` (where digests were last written), or null. */
export const writtenOf = chronicle => slotValue(chronicle?.written);
