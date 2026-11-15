// The Belonging, Closure and Awe signal readers and the closure score.
import { CLOSURE_MIN_DAYS, NEW_MEMBER_DAYS } from './kinds.js';
import { idOf, dayOf, plainCause, samePlace } from './shared-input.js';

const BENCHED_SCORE = 3;
const AWAY_SCORE = 2;
const NEW_MEMBER_SCORE = 1;
const AWE_SCORE = 2;

// Closure score by days an open thread has been waiting: 2 to 3 days = 1, 4 to 6 = 2, 7 or more = 3.
export function closureScore(ageDays) {
    if (!Number.isFinite(ageDays) || ageDays < CLOSURE_MIN_DAYS) return 0;
    if (ageDays >= 7) return 3;
    if (ageDays >= 4) return 2;
    return 1;
}

// Belonging: benched (left out of the party) beats away (a key person who is gone) beats a new member
// who joined within NEW_MEMBER_DAYS. Only the NPC's own id counts. Null when nothing applies.
export function readBelonging(input) {
    const { id, day, benched, keyPeople, joins } = input || {};
    const npc = idOf(id);
    const now = dayOf(day);
    if (!npc || now === null) return null;
    const benchedRow = Array.isArray(benched) ? benched.find(row => idOf(row?.id) === npc) : null;
    if (benchedRow && dayOf(benchedRow.since) !== null) {
        return { kind: 'belonging', score: BENCHED_SCORE, cause: 'benched from the party', since: dayOf(benchedRow.since) };
    }
    const away = Array.isArray(keyPeople) ? keyPeople.find(row => idOf(row?.id) === npc && row.away === true) : null;
    if (away && dayOf(away.since) !== null) {
        return { kind: 'belonging', score: AWAY_SCORE, cause: 'left behind while the group moved on', since: dayOf(away.since) };
    }
    const join = Array.isArray(joins) ? joins.find(row => idOf(row?.id) === npc) : null;
    const joinDay = join ? dayOf(join.day) : null;
    if (joinDay !== null && now - joinDay >= 0 && now - joinDay <= NEW_MEMBER_DAYS) {
        return { kind: 'belonging', score: NEW_MEMBER_SCORE, cause: 'new to the party', since: joinDay };
    }
    return null;
}

// Closure: the oldest-scoring open thread that lists this NPC among its people. Ties go to the earlier
// opening day, then to the thread id, so the pick is stable across replays.
export function readClosure(input) {
    const { id, day, threads } = input || {};
    const npc = idOf(id);
    const now = dayOf(day);
    if (!npc || now === null || !Array.isArray(threads)) return null;
    let best = null;
    for (const thread of threads) {
        if (!thread || thread.open !== true || !Array.isArray(thread.people)) continue;
        if (!thread.people.some(person => idOf(person) === npc)) continue;
        const openedDay = dayOf(thread.openedDay);
        if (openedDay === null) continue;
        const score = closureScore(now - openedDay);
        if (score < 1) continue;
        const candidate = { kind: 'closure', score, cause: plainCause(thread.title, 'an open thread'), since: openedDay, threadId: idOf(thread.id) };
        if (!best || candidate.score > best.score || (candidate.score === best.score && (candidate.since < best.since || (candidate.since === best.since && candidate.threadId < best.threadId)))) best = candidate;
    }
    return best ? { kind: best.kind, score: best.score, cause: best.cause, since: best.since } : null;
}

// Awe: the NPC arrives at a place their own history does not contain. Null when visited is not a list
// (unknown history), so an unreadable place never reads as a first arrival.
export function readAwe(input) {
    const { day, here, visited } = input || {};
    const now = dayOf(day);
    const place = idOf(here);
    if (now === null || !place || !Array.isArray(visited)) return null;
    const seen = visited.some(name => samePlace(name, place));
    if (seen) return null;
    return { kind: 'awe', score: AWE_SCORE, cause: plainCause(`first time at ${place}`, 'a new place'), since: now };
}
