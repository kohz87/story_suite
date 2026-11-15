// Story Director v2, chronicle part: the stored day-facts entries, quest log and note marker, read from the chronicle. Pure.

import { slotValue } from '../../../slot.js';
import { ENTRY_KEY, QUEST_LOG_KEPT, isRecord } from '../shared.js';

/** A thread's kept history, oldest first: `[{ rev, text }]` (the last QUEST_LOG_KEPT). */
export function questLogOf(chronicle, id) {
    if (typeof id !== 'string' || !id) return [];
    return Object.entries(isRecord(chronicle?.questLog) ? chronicle.questLog : {})
        .filter(([key, entry]) => /^\d+$/.test(key) && isRecord(entry) && entry.thread === id)
        .map(([key, entry]) => ({ rev: Number(key), text: entry.text }))
        .sort((a, b) => a.rev - b.rev)
        .slice(-QUEST_LOG_KEPT);
}

/** `chronicle.noted` (where the notes got to), or null. */
export const notedOf = chronicle => slotValue(chronicle?.noted);

/** The day-facts entries kept, by day: `Map(day → [{ key, entry }])`, each day's in revision order. */
export function entriesByDay(chronicle) {
    const out = new Map();
    for (const [key, entry] of Object.entries(isRecord(chronicle?.dayFacts) ? chronicle.dayFacts : {})) {
        const match = ENTRY_KEY.exec(key);
        if (!match || !isRecord(entry) || entry.day !== Number(match[1])) continue;
        if (!out.has(entry.day)) out.set(entry.day, []);
        out.get(entry.day).push({ key, rev: Number(match[2]), entry });
    }
    for (const list of out.values()) list.sort((a, b) => a.rev - b.rev);
    return out;
}

/** `dayOfRev(rev)`: the day whose entries' revision ranges hold `rev`, else null. */
export function rangeDays(byDay) {
    const ranges = [];
    for (const [day, list] of byDay) for (const { entry } of list) if (entry.revs.length === 2) ranges.push([entry.revs[0], entry.revs[1], day]);
    return rev => ranges.find(([lo, hi]) => rev >= lo && rev <= hi)?.[2] ?? null;
}
